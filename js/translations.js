'use strict';

import { la } from './utils.js';

const available_langs = {
  "ar_ar": { "name": "العربية", "file": "ar_ar.json", "direction": "rtl"},
  "en_us": { "name": "English", "file": "en_us.json", "direction": "ltr"}
};

let translationState = null;
let welcomeModal = null;
let handleLanguageChange = null;

// دالة مساعدة لتنظيف النص من الفراغات الزائدة والسطور الجديدة
// لضمان مطابقة المفاتيح في ملف JSON بسهولة
function normalizeText(html) {
  if (!html) return "";
  return html.replace(/\s+/g, ' ').trim();
}

export function lang_init(appState, handleLanguageChangeCb, welcomeModalCb) {
  translationState = appState;
  handleLanguageChange = handleLanguageChangeCb;
  welcomeModal = welcomeModalCb;
  
  let id_iter = 0;
  const items = document.querySelectorAll('.ds-i18n');
  for(const item of items) {
    if (!item.id || item.id.length === 0) {
      item.id = `ds-i18n-${id_iter++}`;
    }
    // نحفظ النص الأصلي "منظفاً" ليكون هو المفتاح الثابت
    translationState.lang_orig_text[item.id] = normalizeText(item.innerHTML);
  }
  translationState.lang_orig_text[".title"] = document.title;
  
  const savedLang = localStorage.getItem('app_lang') || 'en_us';

  if (savedLang === 'ar_ar') {
     const ljson = available_langs['ar_ar'];
     lang_translate(ljson["file"], 'ar_ar', ljson["direction"]).catch(error => {
        console.error("Failed to load Arabic:", error);
     });
  } else {
     lang_reset_page();
  }
}

async function lang_translate(target_file, target_lang, target_direction) {
  try {
    const rootPath = (window.location.pathname.includes('/') && window.location.pathname.split('/').length > 2) ? "../" : "./";
    const response = await fetch(rootPath + "lang/" + target_file);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    const { lang_orig_text, lang_cur } = translationState;
    
    lang_set_direction(target_direction, target_lang);

    // تنظيف المفاتيح داخل ملف JSON أيضاً عند تحميله
    Object.entries(data).forEach(([key, val]) => {
        lang_cur[normalizeText(key)] = val;
    });

    translationState.lang_disabled = false;

    const items = document.querySelectorAll('.ds-i18n');
    for(const item of items) {
      const key = lang_orig_text[item.id]; // هذا هو النص المنظف
      
      let translatedText = null;

      if(lang_cur[key]) {
          translatedText = Array.isArray(lang_cur[key]) ? lang_cur[key][0] : lang_cur[key];
      } 

      if (translatedText) {
        item.innerHTML = translatedText;
      } else if (key.length > 0) {
        console.warn(`Missing translation for HTML element: "${key}"`);
      }
    }

    const old_title = lang_orig_text[".title"];
    if(lang_cur[old_title]) {
        const tTitle = lang_cur[old_title];
        document.title = Array.isArray(tTitle) ? tTitle[0] : tTitle;
    }

    updateLangButton(target_lang);

  } catch (error) {
    console.error("Failed to load translation file:", target_file, error);
  }
}

function lang_reset_page() {
  lang_set_direction("ltr", "en_us");
  translationState.lang_disabled = true;

  const { lang_orig_text } = translationState;
  const items = document.querySelectorAll('.ds-i18n');
  for(const item of items) {
    if (lang_orig_text[item.id]) {
      item.innerHTML = lang_orig_text[item.id];
    }
  }
  
  document.title = lang_orig_text[".title"];
  updateLangButton("en_us");
}

function updateLangButton(currentLang) {
    const curLangEl = document.getElementById("curLang");
    if(curLangEl) {
        curLangEl.innerHTML = (currentLang === 'ar_ar') ? "English" : "العربية";
    }
}

function lang_set_direction(new_direction, lang_name) {
  const lang_prefix = lang_name.split("_")[0];
  document.documentElement.setAttribute("lang", lang_prefix);
  
  if (lang_name === 'ar_ar') {
    document.body.classList.add('ds-i18n-ar');
  } else {
    document.body.classList.remove('ds-i18n-ar');
  }

  if(translationState.lang_cur_direction == new_direction) return;

  const bootstrapCss = document.getElementById('bootstrap-css');
  if (bootstrapCss) {
    const href = (new_direction == "rtl") 
      ? 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css'
      : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    bootstrapCss.setAttribute('href', href);
  }
  document.documentElement.setAttribute("dir", new_direction);
  translationState.lang_cur_direction = new_direction;
}

export function l(text) {
  if(!translationState || translationState.lang_disabled) return text;
  const cleanKey = normalizeText(text);
  const val = translationState.lang_cur[cleanKey];
  const out = Array.isArray(val) ? val[0] : val;
  
  if (!out && cleanKey.length > 0) {
      console.warn(`Missing translation for dynamic text: "${cleanKey}"`);
  }
  return out || text;
}

window.l = l;