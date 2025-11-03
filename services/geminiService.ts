import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { ProductAnalysis, MenuItem, Place, FindItResult, FindItImageResult, Activity, RoutePlace, IngredientInfo, CityCenterInfo, JournalEntry, JournalPhoto, Expense, Trip, ParkingLot, JournalVideo, Tool } from '../types';
import { calculateDistance } from '../utils/helpers';

let ai: GoogleGenAI | null = null;

export const initializeAiClient = (apiKey: string) => {
    ai = new GoogleGenAI({ apiKey });
};

export const verifyApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) {
        return false;
    }
    try {
        const tempAi = new GoogleGenAI({ apiKey });
        // Use a lightweight model and a simple prompt for validation.
        await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: 'hello',
        }, tempAi);
        // If the call succeeds, the key is valid.
        return true;
    } catch (error: any) {
        // API errors (like 400 for invalid key) will be caught here.
        console.error("API Key validation failed:", error);
        return false;
    }
};

const getClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("Gemini AI Client not initialized. Please set the API key.");
    }
    return ai;
};

// Helper function for retrying API calls with exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_RETRIES = 8; // Increased from 5 to 8 for more resilience.

const generateContentWithRetry = async (
    params: Parameters<InstanceType<typeof GoogleGenAI>['models']['generateContent']>[0],
    client?: GoogleGenAI
): Promise<GenerateContentResponse> => {
    let retries = 0;
    while (true) { // Loop will be broken by return or throw
        try {
            const aiClient = client || getClient();
            const response = await aiClient.models.generateContent(params);
            if (!response) {
                throw new Error("API returned undefined response.");
            }
            return response;
        } catch (error: any) {
            const errorMessage = error.message || '';
            const isRetriableError =
                (error.status && error.status >= 500) || // Server errors
                (error.status === 429) || // Rate limit status code
                (errorMessage.includes('RESOURCE_EXHAUSTED')) ||
                (errorMessage.includes('rate limit'));

            if (isRetriableError && retries < MAX_RETRIES) {
                // Specific check for billing/quota issues to provide a better error message.
                if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
                     throw new Error('تم تجاوز الحصة أو هناك مشكلة في الفوترة. يرجى التحقق من خطتك وتفاصيل الفوترة في حساب Google Cloud الخاص بك.');
                }
                
                retries++;
                const backoffTime = Math.pow(2, retries) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                console.warn(`Retriable error detected (${errorMessage || error.status}). Retrying in ${backoffTime.toFixed(0)}ms... (Attempt ${retries}/${MAX_RETRIES})`);
                await delay(backoffTime);
            } else {
                console.error("API call failed after multiple retries or for a non-retriable reason:", error);
                throw error; // Re-throw the error if it's not a retriable issue or retries are exhausted
            }
        }
    }
};

export const interpretUserCommand = async (command: string): Promise<{ tool: Tool; parameters: any; spokenResponse: string } | null> => {
  const toolDescriptions = `
    - FindPlaces: البحث عن أماكن قريبة مثل المطاعم والمساجد. استخدمها لاستعلامات مثل "ابحث عن مطاعم حلال" أو "أين أقرب مقهى".
    - ParkMyCar: مساعدة المستخدم في العثور على سيارته المتوقفة. استخدمها لاستعلامات مثل "أين أوقفت سيارتي؟" أو "ابحث عن سيارتي".
    - ProductAnalyzer: تحليل منتج من صورة أو باركود للتحقق مما إذا كان حلالاً. استخدمها لـ "تحقق من هذا المنتج".
    - MenuAnalyzer: تحليل قائمة مطعم من صورة. استخدمها لـ "حلل هذه القائمة".
    - FindIt: البحث عن منتجات أو متاجر معينة قريبة. استخدمها لـ "أين يمكنني شراء [منتج]؟".
    - OnMyWay: البحث عن أماكن على طول طريق الرحلة. استخدمها لـ "ابحث عن استراحة على طريقي إلى [وجهة]".
    - ActivitiesFinder: العثور على أنشطة وفعاليات قريبة. استخدمها لـ "ماذا أفعل اليوم؟" أو "أنشطة للأطفال".
    - CityCenterFinder: استكشاف وسط المدينة ومعالمها. استخدمها لـ "أين وسط المدينة؟".
    - MyAccommodation: العثور على مكان إقامة المستخدم المحفوظ. استخدمها لـ "أين أسكن؟" أو "العودة إلى الفندق".
    - IngredientGuide: البحث عن معلومات حول المكونات الغذائية. استخدمها لـ "ما هو الجيلاتين؟".
    - MySpace: الوصول إلى مذكرات السفر الشخصية للمستخدم. استخدمها لـ "افتح مذكراتي" أو "مساحتي الشخصية".
    - Favorites: عرض الأماكن والأنشطة المحفوظة. استخدمها لـ "اذهب إلى المفضلة".
    - AskMeAnything: مساعد سفر محادثة للإجابة على أي سؤال. استخدمها لـ "ماذا أحتاج للسفر إلى سويسرا؟" ثم للمتابعة بـ "وماذا عن الطقس هناك؟".
    `;

  const prompt = `
    أنت مساعد ذكي لتطبيق سفر اسمه "زاد". مهمتك هي تفسير أمر المستخدم وتوجيهه إلى الأداة المناسبة داخل التطبيق. أجب فقط بكائن JSON صالح يطابق المخطط المقدم. المستخدم يتحدث باللغة العربية.

    هذه هي قائمة الأدوات المتاحة وأوصافها:
    ${toolDescriptions}

    بناءً على ذلك، قم بتفسير أمر المستخدم التالي:
    "${command}"

    يجب أن يتضمن ردك JSON 'tool' و 'parameters' (كائن يمكن أن يكون فارغًا) و 'spokenResponse' (تأكيد قصير وودي باللغة العربية ليتم نطقه مرة أخرى للمستخدم). بالنسبة للأدوات المتعلقة بالبحث، يجب أن يكون مصطلح بحث المستخدم في 'parameters.query'.
    `;
    
  const commandSchema = {
    type: Type.OBJECT,
    properties: {
      tool: { type: Type.STRING, enum: Object.values(Tool) },
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "مصطلح البحث المستخرج من أمر المستخدم." }
        },
      },
      spokenResponse: { type: Type.STRING, description: "تأكيد قصير وودي باللغة العربية ليتم نطقه مرة أخرى للمستخدم." }
    },
    required: ['tool', 'parameters', 'spokenResponse']
  };

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: commandSchema,
      }
    });
    if (!response) {
      console.error("Error interpreting command: API returned undefined response.");
      return null;
    }
    return JSON.parse(response.text) as { tool: Tool; parameters: any; spokenResponse: string };
  } catch (error) {
    console.error("Error interpreting user command:", error);
    return null;
  }
};


const productAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['حلال', 'حرام', 'مشبوه'] },
    productName: { type: Type.STRING },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['حلال', 'حرام', 'مشبوه'] }
        },
        required: ['name', 'status']
      }
    },
    reasoning: { type: Type.STRING },
    healthInfo: { type: Type.STRING },
    evidence: { type: Type.STRING },
    nutritionFacts: {
      type: Type.ARRAY,
      description: "قائمة بالحقائق الغذائية من جدول المنتج.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "اسم العنصر الغذائي (مثال: سعرات حرارية, دهون كلية)" },
          amount: { type: Type.STRING, description: "كمية العنصر الغذائي مع الوحدة (مثال: 150, 5g)" },
          dailyValue: { type: Type.STRING, description: "النسبة المئوية للقيمة اليومية (مثال: %8)" }
        },
        required: ['name', 'amount']
      }
    },
    healthAdvice: { type: Type.STRING, description: "نصيحة صحية موجزة بناءً على الحقائق الغذائية." }
  },
  required: ['status', 'productName', 'ingredients', 'reasoning']
};

export const analyzeProductImage = async (base64Image: string): Promise<ProductAnalysis | null> => {
  const prompt = `
    حلل صورة المنتج هذه. حدد ما إذا كان المنتج "حلال" أو "حرام" أو "مشبوه".
    قدم اسم المنتج، قائمة بالمكونات الرئيسية وحالة كل منها، وشرحاً مفصلاً للسبب.
    إذا وجدت جدول حقائق غذائية في الصورة، استخرج بياناته بالتفصيل.
    بناءً على الحقائق الغذائية المستخرجة، قدم نصيحة صحية موجزة وفعالة.
    إذا أمكن، قدم معلومات صحية عامة وأي دليل شرعي ذي صلة.
    تأكد من استخدام الأرقام الغربية (1, 2, 3) في جميع الحقول الرقمية والنصية.
    أجب بصيغة JSON فقط.
  `;
  
  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: productAnalysisSchema,
      }
    });
    if (!response) {
        console.error("Error analyzing product image: API returned undefined response.");
        return null;
    }
    return JSON.parse(response.text) as ProductAnalysis;
  } catch (error) {
    console.error("Error analyzing product image:", error);
    return null;
  }
};

export const analyzeProductByBarcode = async (barcode: string): Promise<ProductAnalysis | null> => {
  const prompt = `
    ابحث عن معلومات حول المنتج الذي يحمل الباركود (UPC/EAN) التالي: ${barcode}.
    استخدم بحث Google للعثور على اسم المنتج وقائمة مكوناته.
    بعد العثور على المعلومات، قم بتحليلها. حدد ما إذا كان المنتج "حلال" أو "حرام" أو "مشبوه".
    قدم اسم المنتج، قائمة بالمكونات الرئيسية وحالة كل منها، وشرحاً مفصلاً للسبب.
    إذا وجدت معلومات غذائية، قم بتضمينها وقدم نصيحة صحية موجزة.
    تأكد من استخدام الأرقام الغربية (1, 2, 3) في جميع الحقول.
    أجب بصيغة JSON صالحة فقط. لا تقم بتضمين أي نص إضافي أو علامات markdown.
  `;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      }
    });
    if (!response) {
        console.error(`Error analyzing product with barcode ${barcode}: API returned undefined response.`);
        return null;
    }
    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
    return JSON.parse(jsonString) as ProductAnalysis;
  } catch (error) {
    console.error(`Error analyzing product with barcode ${barcode}:`, error);
    return null;
  }
};

export const analyzeProductByName = async (productName: string): Promise<ProductAnalysis | null> => {
  const prompt = `
    ابحث عبر الإنترنت عن المنتج بالاسم التالي: "${productName}". اعثر على قائمة مكوناته الرسمية.
    بعد العثور على المعلومات، قم بتحليلها لتحديد ما إذا كان المنتج "حلال" أو "حرام" أو "مشبوه".
    قدم اسم المنتج، قائمة بالمكونات وحالة كل منها، وشرحاً مفصلاً للسبب.
    إذا وجدت معلومات غذائية، قم بتضمينها وقدم نصيحة صحية موجزة.
    ملاحظة هامة: استخدم الأرقام الغربية (1, 2, 3) في جميع الحقول.
    أجب بصيغة JSON صالحة فقط. لا تقم بتضمين أي نص إضافي أو علامات markdown.
  `;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // FIX: Removed responseMimeType and responseSchema as they are not allowed with googleSearch tool.
        tools: [{googleSearch: {}}],
      }
    });
     if (!response) {
        console.error(`Error analyzing product by name ${productName}: API returned undefined response.`);
        return null;
    }
    // FIX: Added JSON parsing from text response.
    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
    try {
        return JSON.parse(jsonString) as ProductAnalysis;
    } catch (e) {
        console.error(`Error parsing JSON for product by name "${productName}":`, e, jsonString);
        return null;
    }
  } catch (error) {
    console.error(`Error analyzing product by name ${productName}:`, error);
    return null;
  }
};

// FIX: Added function to resolve error in components/MenuAnalyzer.tsx
export const analyzeMenuImage = async (base64Image: string): Promise<MenuItem[] | null> => {
  const prompt = `
    حلل صورة قائمة الطعام هذه. لكل طبق، حدد ما إذا كان "حلال" أو "حرام" أو "مشبوه".
    قدم اسم الطبق، والحالة، وأي ملاحظات مهمة (مثل المكونات المشبوهة).
    أجب بصيغة JSON فقط، على شكل مصفوفة من الكائنات.
  `;

  const menuAnalysisSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        dishName: { type: Type.STRING },
        status: { type: Type.STRING, enum: ['حلال', 'حرام', 'مشبوه'] },
        notes: { type: Type.STRING }
      },
      required: ['dishName', 'status']
    }
  };

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: menuAnalysisSchema,
      }
    });
    if (!response) {
        console.error("Error analyzing menu image: API returned undefined response.");
        return null;
    }
    return JSON.parse(response.text) as MenuItem[];
  } catch (error) {
    console.error("Error analyzing menu image:", error);
    return null;
  }
};

export const getIngredientInfo = async (query: string): Promise<IngredientInfo | null> => {
  const prompt = `
    قدم تحليلاً مفصلاً للمكون الغذائي التالي: "${query}".
    - حدد اسم المكون بوضوح.
    - حدد حالته: "حلال"، "حرام"، "مشبوه". إذا لم يكن الحكم واضحًا أو كان المكون محايدًا (مثل الماء)، فاستخدم "معلومات".
    - اذكر مصدره (نباتي، حيواني، صناعي، إلخ).
    - قدم وصفًا تفصيليًا للمكون واستخداماته.
    - اشرح سبب الحكم الشرعي (الاستحالة، مصدر حيواني محرم، إلخ).
    - أجب بصيغة JSON فقط.
  `;

  const ingredientInfoSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "الاسم الواضح للمكون الذي تم تحليله." },
      status: { type: Type.STRING, enum: ['حلال', 'حرام', 'مشبوه', 'معلومات'] },
      source: { type: Type.STRING, description: "مصدر المكون (مثال: نباتي, حيواني, صناعي)." },
      description: { type: Type.STRING, description: "شرح تفصيلي للمكون وماهيته واستخداماته الشائعة." },
      reasoning: { type: Type.STRING, description: "الأساس المنطقي أو الشرعي للحكم على حالة المكون." }
    },
    required: ['name', 'status', 'source', 'description', 'reasoning']
  };

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ingredientInfoSchema,
      }
    });
    if (!response) {
        console.error("Error getting ingredient info: API returned undefined response.");
        return null;
    }
    return JSON.parse(response.text) as IngredientInfo;
  } catch (error) {
    console.error("Error getting ingredient info:", error);
    return null;
  }
};

// FIX: Added function to resolve error in components/FindPlaces.tsx
export const findPlacesNearby = async (query: string, location: { lat: number; lon: number }): Promise<Place[] | null> => {
  const prompt = `
    ابحث عن أماكن قريبة بناءً على الاستعلام التالي: "${query}".
    موقعي الحالي هو خط العرض ${location.lat} وخط الطول ${location.lon}.
    تأكد من أن جميع الأرقام (مثل التقييم والمسافة) مكتوبة بالشكل الغربي (1, 2, 3).
    أجب بصيغة JSON فقط، على شكل مصفوفة من الكائنات. يجب أن يحتوي كل كائن على الحقول التالية:
    - name: string (اسم المكان)
    - category: string (فئة المكان، مثل "مطعم" أو "مسجد")
    - rating: number (التقييم من 5، إن وجد)
    - distance: string (المسافة من موقعي، مثل "500 متر" أو "1.2 كم")
    - mapsLink: string (رابط خرائط جوجل للمكان)
  `;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });

    if (!response) {
        console.error("Error finding places nearby: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed as Place[] : null;
    } catch (error) {
      console.error("Error parsing places response as JSON:", textResponse, error);
      if (textResponse.includes("لا توجد نتائج") || textResponse.includes("no results")) {
        return [];
      }
      return null;
    }
  } catch (error) {
    console.error("Error finding places nearby:", error);
    return null;
  }
};

export const findItForMe = async (query: string, location: { lat: number; lon: number }): Promise<FindItResult[] | null> => {
  const prompt = `
    أنت مساعد تسوق شخصي. بناءً على استعلام المستخدم "${query}" وموقعه (خط العرض: ${location.lat}، خط الطول: ${location.lon})، ابحث عن المتاجر القريبة أو المنتجات التي تطابق طلبه.
    - أعطِ الأولوية للنتائج الأقرب للمستخدم.
    - لا تفترض أن المستخدم يبحث عن منتجات "حلال" أو "عربية" إلا إذا طلب ذلك صراحة في استعلامه.
    - إذا كان الاستعلام عن منتج، ابحث عن متاجر تبيعه أو معلومات عامة عنه.
    - إذا كان الاستعلام عن متجر، ابحث عن المتاجر القريبة المطابقة.
    - **أجب باللغة العربية**. يجب أن تكون جميع القيم النصية، خاصة حقل "details"، باللغة العربية.
    - ملاحظة هامة: يجب أن تكون جميع الأرقام في الإجابة، مثل المسافات، مكتوبة بالشكل الغربي (1, 2, 3).
    - أرجع الإجابة كـ JSON array فقط. يجب أن يكون كل عنصر في المصفوفة كائنًا يمثل إما "store" أو "product".

    لكائن "store"، استخدم هذا الهيكل (يجب أن تكون المفاتيح باللغة الإنجليزية):
    {
      "type": "store",
      "name": "اسم المتجر",
      "address": "عنوان المتجر",
      "distance": "المسافة من المستخدم",
      "details": "وصف موجز باللغة العربية للمتجر وما يبيعه.",
      "mapsLink": "رابط خرائط جوجل للمتجر."
    }

    لكائن "product"، استخدم هذا الهيكل (يجب أن تكون المفاتيح باللغة الإنجليزية):
    {
      "type": "product",
      "name": "اسم المنتج / اسم العلامة التجارية",
      "availability": "أين يمكن العثور على هذا المنتج عادةً (على سبيل المثال، 'محلات السوبر ماركت الكبرى'، 'المتاجر المتخصصة').",
      "details": "أي تفاصيل ذات صلة بالمنتج باللغة العربية."
    }
  `;
  
  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}, {googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });

    if (!response) {
        console.error("Error in findItForMe service: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    // Find JSON within ```json ... ``` block or assume the whole response is JSON
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
    
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        // Simple validation to check if it matches our expected structure
        return parsed.filter(item => item.type && item.name && item.details) as FindItResult[];
      }
      return null;
    } catch (e) {
      console.error("Error parsing 'Find It' response JSON:", e, jsonString);
      return null;
    }

  } catch (error) {
    console.error("Error in findItForMe service:", error);
    return null;
  }
};

export const findItByImage = async (base64Image: string, location: { lat: number; lon: number }): Promise<FindItImageResult | null> => {
  const prompt = `بالاعتماد على هذه الصورة وموقعي الحالي (خط العرض: ${location.lat}، خط الطول: ${location.lon})، قم بما يلي:
1.  حدد ما إذا كانت الصورة لـ "product" أم "place" (مثل متجر, معلم, مطعم).
2.  تعرف على اسم المنتج أو المكان.
3.  اكتب وصفًا مفصلاً له.
4.  **إذا كان مكانًا:** ابحث عنه في خرائط Google وقدم رابطًا للوصول إليه.
5.  **إذا كان منتجًا:** اذكر أنواع المتاجر أو الأماكن التي يُباع فيها عادةً (مثال: "المتاجر الآسيوية المتخصصة", "محلات السوبر ماركت الكبرى").
6.  أجب بصيغة JSON فقط باللغة العربية.

**استخدم أحد الهيكلين التاليين بناءً على ما تم التعرف عليه:**

**إذا كان "place":**
{
  "type": "place",
  "name": "اسم المكان",
  "description": "وصف مفصل للمكان",
  "mapsLink": "رابط خرائط جوجل"
}

**إذا كان "product":**
{
  "type": "product",
  "name": "اسم المنتج",
  "description": "وصف مفصل للمتنج",
  "availability": "وصف أماكن توفره"
}`;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ],
      },
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });
    
    if (!response) {
        console.error("Error in findItByImage service: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

    try {
        const parsed = JSON.parse(jsonString);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as FindItImageResult;
        }
        console.error("Parsed JSON for findItByImage is not a valid object:", parsed);
        return null;
    } catch (e) {
        console.error("Error parsing 'Find It by Image' response JSON:", e, jsonString);
        return null;
    }

  } catch (error) {
    console.error("Error in findItByImage service:", error);
    return null;
  }
};


export const findActivitiesNearby = async (query: string, location: { lat: number; lon: number }): Promise<Activity[] | null> => {
  const prompt = `
    أنت مرشد سياحي محلي متخصص في الأنشطة العائلية. ابحث عن أنشطة أو أماكن قريبة بناءً على استعلام المستخدم "${query}" وموقعه الحالي (خط العرض: ${location.lat}، خط الطول: ${location.lon}).
    - أعطِ الأولوية للأنشطة المناسبة للعائلات والأطفال.
    - استخدم بحث Google وخرائط Google للعثور على معلومات دقيقة وحديثة.
    - لكل نشاط، قدم وصفًا جذابًا وموجزًا.
    - **أجب باللغة العربية**.
    - ملاحظة هامة: يجب أن تكون جميع الأرقام في الإجابة، مثل التكلفة والمسافة، مكتوبة بالشكل الغربي (1, 2, 3).
    - أرجع الإجابة كـ JSON array فقط. يجب أن يتبع كل كائن في المصفوفة هذا الهيكل الدقيق (المفاتيح باللغة الإنجليزية):
    {
      "name": "اسم المكان أو النشاط",
      "description": "وصف موجز وجذاب للنشاط أو المكان.",
      "category": "فئة النشاط (مثال: 'حديقة', 'متحف', 'مركز تسوق', 'فعالية')",
      "suitability": "لمن يناسب هذا النشاط (مثال: 'رائع للأطفال', 'مناسب لجميع أفراد العائلة', 'مثالي للمجموعات')",
      "estimatedCost": "التكلفة التقديرية. إذا كان السعر الدقيق معروفًا (مثل سعر التذكرة)، فاذكره كرقم مع العملة (مثال: '50 ريال سعودي للفرد'). إذا لم يكن معروفًا، استخدم تقديرًا وصفيًا مثل 'مجاني'، 'منخفض'، 'متوسط'، 'مرتفع'، أو 'يختلف'.",
      "distance": "المسافة من موقع المستخدم (مثال: '500 متر', '1.5 كم')",
      "mapsLink": "رابط خرائط جوجل للموقع. إذا لم يتم العثور على رابط، يجب إرجاع سلسلة نصية فارغة ''."
    }
  `;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}, {googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });
    
    if (!response) {
        console.error("Error in findActivitiesNearby service: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            return parsed as Activity[];
        }
        console.error("Parsed JSON for activities is not an array:", parsed);
        return null;
    } catch (e) {
        console.error("Error parsing 'Activities' response JSON:", e, jsonString);
        return null;
    }

  } catch (error) {
    console.error("Error in findActivitiesNearby service:", error);
    return null;
  }
};

export const findPlacesOnRoute = async (start: string, destination: string, query: string, location: { lat: number; lon: number } | null): Promise<RoutePlace[] | null> => {
  const startPoint = start === 'موقعي الحالي' && location ? `latitude ${location.lat}, longitude ${location.lon}` : start;

  const prompt = `
    أنت مساعد سفر خبير. مهمتك هي العثور على أماكن تهم المستخدم على طول الطريق بين نقطة بداية ونقطة نهاية.
    - نقطة البداية: "${startPoint}"
    - الوجهة: "${destination}"
    - ما الذي يبحث عنه المستخدم: "${query}"

    تعليمات:
    1.  حدد أفضل مسار للقيادة بين نقطة البداية والوجهة باستخدام خرائط Google.
    2.  ابحث عن أماكن تتوافق مع "${query}" وتقع بالقرب من هذا المسار. يجب أن يكون الانعطاف للوصول إليها معقولاً.
    3.  لكل مكان تجده، قم بتوفير المعلومات المطلوبة بالتنسيق المحدد أدناه.
    4.  **رتب النتائج من الأقرب (أقل مسافة انعطاف) إلى الأبعد.**
    5.  **أجب باللغة العربية**.
    6.  ملاحظة هامة: يجب أن تكون جميع الأرقام في الإجابة مكتوبة بالشكل الغربي (1, 2, 3).
    7.  أرجع الإجابة كـ JSON array فقط. يجب أن يتبع كل كائن في المصفوفة هذا الهيكل الدقيق (المفاتيح باللغة الإنجليزية):
    {
      "name": "اسم المكان",
      "category": "فئة المكان (مثال: 'مطعم', 'مسجد', 'محطة استراحة')",
      "details": "وصف موجز للمكان ولماذا هو مناسب كاستراحة على الطريق.",
      "detour": "مسافة الانعطاف بالكيلومتر كنص وصفي (مثال: 'على الطريق مباشرة'، 'انعطاف 3.5 كم').",
      "detourInKm": "مسافة الانعطاف كرقم بالكيلومتر فقط (مثال: 0, 3.5). استخدم 0 إذا كان المكان على الطريق مباشرة.",
      "distanceFromStart": "المسافة التقريبية من نقطة الانطلاق على طول المسار (مثال: 'بعد 120 كم').",
      "mapsLink": "رابط خرائط جوجل للموقع"
    }
  `;

  try {
    const config: any = {
      tools: [{googleSearch: {}}, {googleMaps: {}}],
    };

    if (start === 'موقعي الحالي' && location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: location.lat,
            longitude: location.lon
          }
        }
      };
    }

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: config,
    });
    
    if (!response) {
        console.error("Error in findPlacesOnRoute service: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            return parsed as RoutePlace[];
        }
        console.error("Parsed JSON for route places is not an array:", parsed);
        return null;
    } catch (e) {
        console.error("Error parsing 'On My Way' response JSON:", e, jsonString);
        return null;
    }

  } catch (error) {
    console.error("Error in findPlacesOnRoute service:", error);
    return null;
  }
};

export const findCityCenters = async (location: { lat: number; lon: number }): Promise<CityCenterInfo[] | null> => {
  const prompt = `
    أنت خبير سياحي محلي. بناءً على موقعي الحالي (خط العرض: ${location.lat}، خط الطول: ${location.lon})، حدد 3 إلى 4 من مراكز المدن أو البلدات القريبة والمناطق الحيوية التي تستحق الزيارة.
    - استخدم خرائط Google وبحث Google لتحديد المناطق بدقة وإحداثياتها الجغرافية (خط العرض وخط الطول).
    - لكل منطقة، ابحث عن 2-3 مطاعم ومقاهي مشهورة جدًا بين الزوار والسياح.
    - **أجب باللغة العربية**.
    - ملاحظة هامة: يجب أن تكون جميع الأرقام في الإجابة، بما في ذلك إحداثيات خطوط الطول والعرض، مكتوبة بالشكل الغربي (1, 2, 3).
    - أرجع الإجابة كـ JSON array فقط. يجب أن يتبع كل كائن في المصفوفة هذا الهيكل الدقيق (المفاتيح باللغة الإنجليزية):
    {
      "name": "اسم منطقة وسط المدينة (مثال: وسط مدينة إنترلاكن)",
      "description": "وصف مفصل وجذاب للمنطقة وما يميزها.",
      "lat": "خط عرض مركز المنطقة (مثال: 46.6863)",
      "lon": "خط طول مركز المنطقة (مثال: 7.8632)",
      "popularSpots": [
        {
          "name": "اسم المطعم أو المقهى",
          "type": "مطعم" | "مقهى",
          "description": "سبب شهرة هذا المكان (مثال: 'مشهور بقهوته المختصة وإطلالته الرائعة')"
        }
      ],
      "mapsLink": "رابط خرائط جوجل للمنطقة"
    }
  `;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}, {googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });
    
    if (!response) {
        console.error("Error in findCityCenters service: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
    
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            // Calculate distance for each result
            const resultsWithDistance: CityCenterInfo[] = parsed.map(center => {
                const distance = (center.lat && center.lon) 
                    ? calculateDistance(location.lat, location.lon, center.lat, center.lon)
                    : 'غير معروف';
                return { ...center, distance };
            });
            return resultsWithDistance;
        }
        console.error("Parsed JSON for city centers is not an array:", parsed);
        return null;
    } catch (e) {
        console.error("Error parsing 'City Centers' response JSON:", e, jsonString);
        return null;
    }

  } catch (error) {
    console.error("Error in findCityCenters service:", error);
    return null;
  }
};

export const describeParkingLocation = async (base64Image: string, location: { lat: number, lon: number }): Promise<string | null> => {
  const prompt = `
    أنت مساعد ذكي لمساعدة المستخدمين على تذكر أين أوقفوا سياراتهم.
    بناءً على صورة موقف السيارة هذه وموقعي التقريبي (خط العرض: ${location.lat}, خط الطول: ${location.lon})، قم بإنشاء وصف قصير جدًا ومفيد جدًا للموقع.
    - ركز على المعالم البارزة والفريدة في الصورة (مثل: "بجانب المصعد الأحمر"، "أمام العمود رقم B12", "في الطابق الثالث G3").
    - إذا لم تكن هناك معالم واضحة، صف البيئة المحيطة (مثل: "في موقف خارجي بجوار شجرة كبيرة"، "في شارع جانبي خلف مبنى أصفر").
    - اجعل الوصف لا يتجاوز 15 كلمة.
    - استخدم الأرقام الغربية (مثل B12, G3, 5) إذا لزم الأمر.
    - أجب بالوصف النصي فقط، بدون أي مقدمات أو تنسيق.
    
    مثال 1: "الطابق السفلي P2، بجوار العمود رقم C5."
    مثال 2: "في الخارج، أمام مدخل السوبرماركت مباشرة."
    مثال 3: "الصف 5، بالقرب من مخرج الطوارئ الأخضر."
  `;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ],
      },
    });
    if (!response) {
        console.error("Error describing parking location: API returned undefined response.");
        return "لم أتمكن من إنشاء وصف. تم حفظ الموقع والصورة.";
    }
    return response.text.trim();
  } catch (error) {
    console.error("Error describing parking location:", error);
    return "لم أتمكن من إنشاء وصف. تم حفظ الموقع والصورة.";
  }
};


export const summarizeJournalEntry = async (notes: string, photos: JournalPhoto[], videos: JournalVideo[], location: { lat: number; lon: number } | null): Promise<string | null> => {
    const locationInfo = location ? `للمعلومية، موقعي التقريبي العام هو خط العرض ${location.lat} وخط الطول ${location.lon}.` : '';
    const videoInfo = videos.length > 0 ? `بالإضافة إلى ذلك، قام المستخدم بتسجيل ${videos.length} مقطع فيديو. هذا يعكس أن اليوم كان مليئًا بالأحداث الحية. اذكر هذا في قصتك.` : '';

    const prompt = `
    أنت كاتب قصص سفر مبدع ومساعد شخصي. مهمتك هي تحليل ملاحظات المستخدم، والصور التي التقطها، والفيديوهات التي سجلها، ومواقعها الجغرافية، ثم دمج كل ذلك في قصة يومية مؤثرة ومكتوبة بلسان المستخدم نفسه (بضمير المتكلم "أنا" أو "نحن").

    **التعليمات الأساسية:**
    1.  **تحليل الوسائط:** انظر إلى الصور بعناية فائقة. ${videoInfo}
    2.  **دمج المعلومات:** ادمج ملاحظات المستخدم النصية مع ما تراه في الصور بسلاسة. **لكل صورة، سأزودك بوصف نصي يسبقها. إذا كان هذا الوصف يحتوي على إحداثيات جغرافية، فهذا هو الموقع الدقيق للصورة ويجب أن تعطي له الأولوية القصوى لتحديد اسم المكان أو المعلم.**
    3.  **الموقع العام (للسياق فقط):** ${locationInfo} استخدم هذا الموقع فقط إذا لم تتوفر إحداثيات محددة للصورة لفهم السياق العام لليوم.
    4.  **الأسلوب:** يجب أن تكون القصة شخصية وعاطفية، مع التركيز على المشاعر والذكريات. استخدم اللغة العربية بأسلوب أدبي وجذاب.
    5.  **التنسيق:** ابدأ القصة مباشرة دون أي مقدمات أو عناوين (مثل "ملخص يومك:").
    6.  **الأرقام:** استخدم الأرقام الغربية (1, 2, 3) دائمًا عند ذكر أي أرقام.

    **ملاحظات المستخدم الأولية (قد تكون فارغة):**
    ---
    ${notes || "لم يدون المستخدم أي ملاحظات نصية، لذا اعتمد بشكل أساسي على تحليل الصور والفيديوهات المرفقة ومواقعها لكتابة القصة."}
    ---
    `;

    const contentParts: any[] = [{ text: prompt }];
    
    // Add photos with their context to the request
    photos.forEach((photo, index) => {
        let photoContext = `--- \nصورة رقم ${index + 1}:`;
        if (photo.lat && photo.lon) {
            photoContext += ` تم التقاط هذه الصورة عند الإحداثيات الدقيقة (خط العرض: ${photo.lat}, خط الطول: ${photo.lon}). هذا هو موقعها الفعلي، الرجاء تحديد المكان بدقة في قصتك.`;
        }
        contentParts.push({ text: photoContext });
        contentParts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: photo.base64
            }
        });
    });

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash", 
            contents: { parts: contentParts },
        });
        if (!response) {
            console.error("Error summarizing journal entry: API returned undefined response.");
            return null;
        }
        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing journal entry with images:", error);
        return null;
    }
};

export const summarizeEntireTrip = async (entries: JournalEntry[]): Promise<string | null> => {
    const tripContent = entries
        .filter(entry => entry.notes.trim() !== '' || entry.photos.length > 0 || entry.videos.length > 0)
        .map(entry => {
            return `
        تاريخ: ${entry.date}
        عنوان اليوم: ${entry.title}
        ملاحظات: ${entry.notes.replace(/---/g, '')}
        عدد الصور: ${entry.photos.length}
        عدد الفيديوهات: ${entry.videos.length}
        `;
        })
        .join('\n---\n');

    if (!tripContent) {
        return "لم تتم كتابة أي مذكرات أو إضافة صور أو فيديوهات لهذه الرحلة بعد.";
    }

    const prompt = `
    أنت كاتب قصص سفر محترف. مهمتك هي قراءة مجموعة من المذكرات اليومية لرحلة وتحويلها إلى قصة واحدة متكاملة وملهمة بلسان المسافر نفسه.
    - اكتب القصة بضمير المتكلم ("سافرتُ"، "شاهدنا").
    - ابدأ بمقدمة جذابة، ثم اروِ أحداث الرحلة بتسلسل زمني، واختتم بخاتمة مؤثرة تلخص مشاعر التجربة.
    - ركز على ربط الأحداث والمشاعر لخلق سرد متماسك.
    - يجب أن تكون القصة باللغة العربية وبأسلوب أدبي وبليغ.
    - لا تذكر "ملاحظات المستخدم" أو "عدد الصور والفيديوهات" بشكل مباشر، بل استخدمها كمصدر إلهام لكتابة القصة (مثلاً، "كان يومًا مليئًا باللحظات الحية التي وثقناها").
    - استخدم الأرقام الغربية (1, 2, 3) دائمًا عند ذكر أي أرقام.
    - تجنب العناوين مثل "ملخص الرحلة". ابدأ القصة مباشرة.

    محتوى الرحلة:
    ---
    ${tripContent}
    ---
    `;

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash", 
            contents: prompt,
        });
        if (!response) {
            console.error("Error summarizing entire trip: API returned undefined response.");
            return null;
        }
        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing entire trip:", error);
        return null;
    }
};

// Define simplified types for the prompt to avoid sending large base64 data
interface SimplifiedJournalPhoto {
    id: string;
    lat?: number;
    lon?: number;
}
interface SimplifiedJournalVideo {
    id: string;
    lat?: number;
    lon?: number;
}
interface SimplifiedExpense extends Omit<Expense, 'photos'> {}

interface SimplifiedJournalEntry {
    id: string;
    date: string;
    title: string;
    notes: string;
    photos: SimplifiedJournalPhoto[];
    videos: SimplifiedJournalPhoto[]; // Simplified for consistency
    expenses: SimplifiedExpense[];
}
interface SimplifiedTrip {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    entries: SimplifiedJournalEntry[];
}

export const generateTripHtmlStory = async (trip: SimplifiedTrip, tripSummary: string | null): Promise<string | null> => {
    const tripDataString = JSON.stringify(trip, null, 2);

    const prompt = `
    أنت خبير في كتابة مدونات السفر ومصمم ويب موهوب، وتتقن اللغة العربية. مهمتك هي تحويل بيانات رحلة أولية إلى صفحة ويب (HTML) تفاعلية وجميلة، كملف واحد ومستقل.

    **التعليمات الأساسية:**
    1.  **المخرج النهائي:** يجب أن يكون الناتج عبارة عن مستند HTML كامل (يبدأ بـ \`<!DOCTYPE html>\` وينتهي بـ \`</html>\`). يجب أن يكون كل شيء (HTML, CSS) في ملف واحد.
    2.  **التصميم والـ CSS:**
        *   يجب أن تكون جميع الأنماط (CSS) داخل وسم \`<style>\` واحد في الـ \`<head>\`.
        *   استخدم خط 'Tajawal' من Google Fonts (عبر \`@import\`).
        *   يجب أن يكون التصميم أنيقًا، عصريًا، ومتجاوبًا بالكامل (responsive).
        *   **إصلاح مهم:** يجب أن تضيف الـ CSS التالي إلى وسم \`<style>\` لضمان عمل روابط المواقع بشكل صحيح:
            \`\`\`css
            .media-container { position: relative; display: block; overflow: hidden; border-radius: 0.75rem; }
            .location-link {
                position: absolute; bottom: 8px; left: 8px; z-index: 10;
                background-color: rgba(0, 0, 0, 0.6); color: white; border-radius: 50%;
                width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
                transition: background-color 0.2s; text-decoration: none;
            }
            .location-link:hover { background-color: rgba(0, 0, 0, 0.8); }
            .location-link svg { width: 20px; height: 20px; }
            \`\`\`
    3.  **هيكل الصفحة (HTML):**
        *   **اللغة والاتجاه:** يجب أن يكون لوسم \`<html>\` السمات \`lang="ar" dir="rtl"\`.
        *   **الغلاف (Hero Section):** ابدأ بغلاف جذاب. استخدم الصورة الأولى من الرحلة كخلفية له.
        *   **قصة الرحلة:** ضع ملخص الرحلة في قسم خاص وأنيق.
        *   **الأيام (Daily Entries):** لكل يوم في الرحلة، أنشئ قسمًا خاصًا.
    4.  **بيانات الوسائط:** **مهم جداً:** لقد قمت بتزويدك بمعرفات فريدة للصور (\`photo.id\`) والفيديوهات (\`video.id\`). عند إنشاء وسوم \`<img>\` و \`<video>\`، **يجب أن تستخدم هذه المعرفات كقيمة لخاصية \`src\`**. سأقوم لاحقًا باستبدال هذه المعرفات.
    5.  **ميزة موقع الوسائط (مهم جدًا للتصحيح):** إذا كانت الصورة أو الفيديو يحتوي على \`lat\` و \`lon\`, اتبع هذه التعليمات بدقة:
        *   ضع الوسيط (\`<img>\` أو \`<video>\`) داخل حاوية \`<div class="media-container">\`.
        *   مباشرة بعد الوسيط، أضف رابط الموقع باستخدام كود HTML التالي بالضبط، مع استبدال \`LAT_PLACEHOLDER\` و \`LON_PLACEHOLDER\` بقيم خط العرض والطول الفعلية:
            \`\`\`html
            <a href="https://www.google.com/maps?q=LAT_PLACEHOLDER,LON_PLACEHOLDER" target="_blank" rel="noopener noreferrer" class="location-link" title="عرض الموقع على الخريطة" onclick="event.stopPropagation()">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </a>
            \`\`\`
    6.  **المحتوى:** يجب أن يكون كل المحتوى باللغة العربية، مع استخدام الأرقام الغربية (1, 2, 3).

    **ملخص قصة الرحلة:**
    ---
    ${tripSummary || "لم يتم إنشاء ملخص لهذه الرحلة."}
    ---

    **بيانات الرحلة المبسطة (JSON):**
    ---
    ${tripDataString}
    ---

    الآن، يرجى إنشاء صفحة الـ HTML الكاملة.
    `;

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        if (!response) {
            console.error("Error generating trip HTML story: API returned undefined response.");
            return null;
        }
        // Clean up the response to ensure it's valid HTML
        const htmlResponse = response.text.trim();
        if (htmlResponse.startsWith('```html')) {
            return htmlResponse.replace(/```html\s*|```/g, '').trim();
        }
        return htmlResponse;
    } catch (error) {
        console.error("Error generating trip HTML story:", error);
        return null;
    }
};


export const processExpense = async (data: { text: string; }): Promise<Omit<Expense, 'id' | 'description'> | null> => {
    const prompt = `
    أنت مساعد مالي ذكي. مهمتك هي تحليل نص مصروف، واستخراج المبلغ والعملة، ثم تحويل المبلغ إلى الريال السعودي (SAR) باستخدام أحدث أسعار الصرف.

    النص المراد تحليله: "${data.text}"

    التعليمات:
    1.  اقرأ النص واستخرج المبلغ الرقمي والعملة (مثل 'USD', '€', 'CHF', 'فرنك').
    2.  إذا لم تكن العملة واضحة، افترض أنها العملة المحلية للبلد الذي قد يتواجد فيه المستخدم (استخدم المنطق العام). إذا لم يكن هناك أي دليل، افترض أنها 'USD'.
    3.  استخدم بحث Google للعثور على أحدث سعر صرف من العملة المستخرجة إلى SAR.
    4.  قم بإجراء عملية التحويل بدقة.
    5.  استخدم الأرقام الغربية (1, 2, 3) فقط في إجابتك.
    6.  أجب بصيغة JSON فقط. يجب أن يحتوي الكائن على المفاتيح التالية بالضبط (باللغة الإنجليزية):
        - amount: number (المبلغ الأصلي)
        - currency: string (رمز العملة الأصلي المكون من 3 أحرف، مثل 'EUR')
        - amountInSAR: number (المبلغ المحول إلى الريال السعودي)
    
    الرجاء الإجابة بصيغة JSON فقط، بدون أي علامات markdown إضافية مثل \`\`\`json.
    `;

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        if (!response) {
            console.error("Error processing expense: API returned undefined response.");
            return null;
        }

        const textResponse = response.text.trim();
        // The prompt now asks for raw JSON, so we can parse directly.
        // Adding a fallback for safety.
        const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
        
        return JSON.parse(jsonString) as Omit<Expense, 'id' | 'description'>;
    } catch (error) {
        console.error("Error processing expense:", error);
        return null;
    }
};

export const refineExpenseDescription = async (description: string): Promise<string> => {
    const prompt = `
    أعد صياغة وصف المصروف التالي لجعله يبدو أكثر أناقة وجمالاً ومناسباً لدفتر يوميات رحلة. **يجب أن تكون الإجابة باللغة العربية**. اجعل الوصف موجزاً ومعبراً. استخدم الأرقام الغربية (1, 2, 3).

    الوصف الأصلي: "${description}"

    الوصف المحسن (أجب بالنص المحسن فقط بدون أي مقدمات):
    `;

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        if (!response) {
            console.error("Error refining expense description: API returned undefined response.");
            return description;
        }
        // Return the refined text, or the original if something goes wrong
        return response.text.trim() || description;
    } catch (error) {
        console.error("Error refining expense description:", error);
        // Fallback to original description on error
        return description;
    }
};

export const analyzeReceiptImage = async (base64Image: string): Promise<{ description: string; amount: number; currency: string; amountInSAR: number; } | null> => {
    const prompt = `
    أنت مساعد ذكاء اصطناعي متخصص في تحليل إيصالات السفر لتطبيق دفتر يوميات. مهمتك هي استخراج المعلومات الأساسية بدقة.

    **التعليمات:**
    1.  **تحليل الصورة:** افحص صورة الإيصال بعناية.
    2.  **استخراج المبلغ الإجمالي:** حدد المبلغ الإجمالي النهائي المدفوع. هذا هو الرقم الأهم، وغالبًا ما يكون بجوار كلمات مثل "Total", "Grand Total", "Amount Paid".
    3.  **تحديد العملة:** تعرف على العملة (مثال: 'EUR', 'CHF', '$', '€'). قم بتحويل الرموز إلى رمز ISO المكون من 3 أحرف (مثال: '$' -> 'USD', '€' -> 'EUR').
    4.  **تحويل العملة إلى SAR:** استخدم بحث Google للعثور على أحدث سعر صرف وتحويل المبلغ الإجمالي إلى الريال السعودي (SAR).
    5.  **إنشاء الوصف:** من اسم المتجر أو قائمة المنتجات، قم بصياغة وصف موجز وأنيق للمصروف. **يجب أن يكون الوصف باللغة العربية حصراً** (مثال: "عشاء في مطعم الجبل"، "مشتريات من سوبرماركت Coop"، "تذاكر دخول المتحف").
    6.  **تنسيق الإجابة:** أجب بصيغة JSON صالحة فقط، بدون أي نص إضافي أو علامات markdown. تأكد من أن جميع الأرقام هي أرقام غربية (1, 2, 3). يجب أن يحتوي الكائن على المفاتيح التالية بالضبط (باللغة الإنجليزية):
        - \`description\`: string
        - \`amount\`: number
        - \`currency\`: string (رمز ISO)
        - \`amountInSAR\`: number

    **مثال للإجابة:**
    {"description": "مشتريات بقالة من Migros", "amount": 75.50, "currency": "CHF", "amountInSAR": 315.20}
    `;

    try {
        const response = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt },
                ],
            },
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        if (!response) {
            console.error("Error analyzing receipt image: API returned undefined response.");
            return null;
        }

        const textResponse = response.text.trim();
        const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
        
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error analyzing receipt image:", error);
        return null;
    }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string | null> => {
    const prompt = "Transcribe this audio recording accurately into Arabic. Respond with only the transcribed text. Use Western Arabic numerals (1, 2, 3) for any numbers.";
    try {
      const response = await generateContentWithRetry({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      });
      if (!response) {
        console.error("Error transcribing audio: API returned undefined response.");
        return null;
      }
      return response.text.trim();
    } catch (error) {
      console.error("Error transcribing audio:", error);
      return null;
    }
  };
  
  export const analyzeExpenseFromAudio = async (audioBase64: string, mimeType: string): Promise<{ description: string; amountText: string } | null> => {
    const prompt = `
    Listen to this audio recording in Arabic of a user describing a travel expense. Your task is to extract the following information and return it as a valid JSON object:
    1.  'description': A brief, refined description of the expense in Arabic. For example, if the user says "تغدينا في مطعم هندي", the description should be "غداء في مطعم هندي".
    2.  'amountText': The amount and currency as a single string. For example, if the user says "كلفنا 90 فرنك سويسري", this should be "90 CHF". Use standard currency codes (EUR, CHF, USD, SAR, etc.).
    
    Important: Use Western Arabic numerals (e.g., 45, 90) in the 'amountText' field.

    Example user audio: "اشترينا اليوم شوية هدايا تذكارية، كلفت حوالي 45 يورو"
    Example JSON output:
    {"description": "هدايا تذكارية", "amountText": "45 EUR"}

    Respond with only the JSON object, without any additional text or markdown formatting.
    `;

    try {
      const response = await generateContentWithRetry({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      });

      if (!response) {
        console.error("Error analyzing expense from audio: API returned undefined response.");
        return null;
      }

      const textResponse = response.text.trim();
      const jsonMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : textResponse;
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Error analyzing expense from audio:", error);
      return null;
    }
  };
  
export const findNearbyParking = async (location: { lat: number; lon: number }): Promise<ParkingLot[] | null> => {
  const prompt = `
    بناءً على موقعي الحالي (خط العرض: ${location.lat}، خط الطول: ${location.lon})، ابحث عن مواقف سيارات عامة قريبة.
    لكل موقف، قدم المعلومات التالية في مصفوفة JSON:
    - name: اسم الموقف (مثال: 'Parking Bahnhof Interlaken Ost').
    - distance: المسافة من موقعي الحالي (مثال: '300 متر').
    - parkingType: صنف نظام الدفع. استخدم إحدى هذه القيم العربية الدقيقة: 'بالساعة' (للمواقف في الشارع أو التي تدفع فيها لعدد معين من الساعات مقدمًا)، 'تدفع عند الخروج' (للجراجات والحواجز حيث تأخذ تذكرة وتدفع عند المغادرة)، 'مجاني' (إذا كان الموقف مجانيًا)، أو 'غير معروف' (إذا لم يمكن تحديد النوع).
    - details: وصف موجز باللغة العربية عن الموقف، مثل حجمه أو طرق الدفع إذا كانت معروفة.
    - mapsLink: رابط خرائط جوجل للموقع.
    
    استخدم خرائط Google للعثور على هذه المعلومات. أجب باللغة العربية وبمصفوفة JSON فقط. تأكد من أن جميع الأرقام للمسافات مكتوبة بالشكل الغربي (1, 2, 3).
  `;

  try {
    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lon
            }
          }
        }
      },
    });

    if (!response) {
        console.error("Error finding nearby parking: API returned undefined response.");
        return null;
    }

    const textResponse = response.text.trim();
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : textResponse;

    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed as ParkingLot[] : null;
    } catch (error) {
      console.error("Error parsing parking response as JSON:", textResponse, error);
      return null;
    }
  } catch (error) {
    console.error("Error finding nearby parking:", error);
    return null;
  }
};

export const startChatSession = (): Chat => {
    const aiClient = getClient();
    const systemInstruction = `أنت خبير سفر عالمي واسع المعرفة ومساعد للغاية. مهمتك هي الإجابة على سؤال المستخدم المتعلق بالسفر بطريقة شاملة ومفيدة ومنظمة.
- إذا تم تقديم صورة، فاستخدمها كجزء أساسي من السياق للإجابة على السؤال.
- أجب باللغة العربية.
- قم بتنسيق إجابتك باستخدام Markdown لسهولة القراءة (استخدم القوائم النقطية والرقمية، والنص العريض، إلخ).
- قدم إجابات عملية وقابلة للتنفيذ. إذا كان السؤال يتعلق بقائمة، فقدمها كقائمة. إذا كان يتعلق بخطة، فقدم خطة منظمة.
- حافظ على نبرة ودودة ومشجعة.
- استخدم الأرقام الغربية (1, 2, 3) دائمًا.`;
    
    return aiClient.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};