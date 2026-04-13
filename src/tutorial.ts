export type Lang = "it" | "en";

type TutorialInlinePart = string | { text: string; href: string };
type TutorialItem = TutorialInlinePart | TutorialInlinePart[];

interface TutorialSection {
  title: string;
  items: TutorialItem[];
  ordered?: boolean;
  note?: string;
}

interface TutorialContent {
  sections: TutorialSection[];
}

const it: TutorialContent = {
  sections: [
    {
      title: "🎯 Scopo dell'app",
      items: [
        "Keep The Check ti aiuta a tenere traccia dei prezzi durante la spesa.",
        "Inquadra etichette o scontrini con la fotocamera: l'app estrae automaticamente prezzi e nomi prodotto tramite OCR e intelligenza artificiale.",
        "Il totale viene aggiornato in tempo reale man mano che aggiungi articoli.",
      ],
    },
    {
      title: "📷 Scansione",
      items: [
        "Premi il pulsante SCAN (icona fotocamera) per acquisire un frame dalla fotocamera.",
        "Usa lo slider per regolare il crop verticale dell'immagine: le maschere nere indicano la zona esclusa dalla scansione.",
        "L'immagine ritagliata viene inviata all'OCR e poi all'AI per estrarre prodotto e prezzo.",
        "Il risultato compare immediatamente nella lista sotto.",
      ],
    },
    {
      title: "➕ Aggiunta manuale",
      items: [
        "Premi il pulsante + per aprire la modale di aggiunta manuale.",
        "Inserisci il nome del prodotto e il prezzo unitario.",
        "Usa i pulsanti − / + nella modale per impostare la quantità desiderata prima di confermare.",
        "Conferma con ✓ o annulla con ✗.",
      ],
    },
    {
      title: "📋 Lista articoli",
      items: [
        "Ogni riga mostra: nome prodotto, prezzo totale (unitario × quantità), pulsanti − / + per la quantità, pulsante × per rimuovere l'articolo.",
        "Il numero centrale indica la quantità: usa − e + per modificarla senza rimuovere l'articolo.",
        "La quantità minima è 1: il pulsante − non ha effetto al di sotto di questo valore.",
        "Gli articoli in rosso indicano un errore di scansione.",
      ],
    },
    {
      title: "💰 Totale, Cash e Coupon",
      items: [
        "TOTAL (verde): somma di tutti gli articoli in lista, aggiornata in tempo reale.",
        "COUPONS: numero di buoni sconto guadagnati in base alla soglia configurata nelle opzioni. Compare solo se > 0.",
        "CASH: appare quando hai almeno un coupon. Indica la parte del totale non coperta dai coupon. Es. Total 11€, coupon val 8€ × 1 → Cash 3€.",
        "Un alert arancione compare automaticamente quando sei vicino alla soglia per il prossimo coupon.",
      ],
    },
    {
      title: "⚙️ Opzioni",
      items: [
        "AI Client: scegli tra Gemini (Google) e Groq (Meta Llama). Richiede la rispettiva API key.",
        "OCR Engine: scegli il motore OCR Space (1, 2 o 3). Il motore 3 è il più accurato.",
        "isTable: attiva se l'immagine contiene dati in formato tabellare.",
        "Use OCR: abilita il riconoscimento OCR prima di inviare all'AI.",
        "Currency: seleziona la valuta da visualizzare accanto ai prezzi.",
        "OCR Key: inserisci la tua API key di OCR Space.",
        "AI Key: inserisci la tua API key di Gemini o Groq.",
        "Use Coupons: attiva il sistema coupon.",
        "Value: valore in denaro per guadagnare un coupon.",
        "Threshold: percentuale del valore coupon entro cui scatta l'alert di avvicinamento.",
        "Import (📁): carica un file .yml con le configurazioni salvate.",
        "Export (↓): scarica le configurazioni attuali come file .yml.",
      ],
    },
    {
      title: "🔑 API key di Gemini",
      ordered: true,
      items: [
        ["Vai su Google AI Studio: ", { text: "aistudio.google.com", href: "https://aistudio.google.com" }],
        "Accedi con il tuo account Google.",
        "Clicca su 'Get API key' nel menu a sinistra.",
        "Clicca 'Create API key' e seleziona o crea un progetto Google Cloud.",
        "Copia la chiave generata e incollala nel campo AI Key nelle Opzioni.",
      ],
      note: "⚠️ Il piano gratuito ha limiti di richieste al minuto e al giorno.",
    },
    {
      title: "🔑 API key di Groq",
      ordered: true,
      items: [
        ["Vai su Groq Console: ", { text: "console.groq.com", href: "https://console.groq.com" }],
        "Crea un account (puoi usare Google o GitHub).",
        "Nel menu a sinistra clicca su 'API Keys'.",
        "Clicca 'Create API Key', dagli un nome e conferma.",
        "Copia subito la chiave (mostrata una sola volta) e incollala nel campo AI Key.",
      ],
      note: "✅ Il piano gratuito offre 14.400 richieste/giorno con Llama 3.",
    },
    {
      title: "🔑 API key di OCR Space",
      ordered: true,
      items: [
        ["Vai su OCR Space: ", { text: "ocr.space/ocrapi", href: "https://ocr.space/ocrapi" }],
        "Clicca su 'Register for free API key'.",
        "Inserisci la tua email e completa la registrazione.",
        "Riceverai la chiave via email. Copiala e incollala nel campo OCR Key.",
      ],
      note: "✅ Il piano gratuito permette 500 richieste al giorno.",
    },
  ],
};

const en: TutorialContent = {
  sections: [
    {
      title: "🎯 App Purpose",
      items: [
        "Keep The Check helps you track prices while shopping.",
        "Point your camera at price tags or receipts: the app automatically extracts prices and product names using OCR and AI.",
        "The total updates in real time as you add items.",
      ],
    },
    {
      title: "📷 Scanning",
      items: [
        "Press the SCAN button (camera icon) to capture a frame from the camera.",
        "Use the slider to crop the image vertically: the black masks show the excluded area.",
        "The cropped image is sent to OCR and then to AI to extract product and price.",
        "The result appears immediately in the list below.",
      ],
    },
    {
      title: "➕ Manual Entry",
      items: [
        "Press the + button to open the manual entry modal.",
        "Enter the product name and unit price.",
        "Use the − / + buttons in the modal to set the desired quantity before confirming.",
        "Confirm with ✓ or cancel with ✗.",
      ],
    },
    {
      title: "📋 Item List",
      items: [
        "Each row shows: product name, total price (unit × quantity), − / + buttons for quantity, × button to remove.",
        "The central number shows the quantity: use − and + to change it without removing the item.",
        "Minimum quantity is 1: the − button has no effect below this value.",
        "Items in red indicate a scan error.",
      ],
    },
    {
      title: "💰 Total, Cash and Coupons",
      items: [
        "TOTAL (green): sum of all items in the list, updated in real time.",
        "COUPONS: number of discount vouchers earned based on the threshold set in options. Shown only if > 0.",
        "CASH: appears when you have at least one coupon. Shows the part of the total not covered by coupons. E.g. Total €11, coupon val €8 × 1 → Cash €3.",
        "An orange alert appears automatically when you are close to the next coupon threshold.",
      ],
    },
    {
      title: "⚙️ Options",
      items: [
        "AI Client: choose between Gemini (Google) and Groq (Meta Llama). Requires the respective API key.",
        "OCR Engine: choose the OCR Space engine (1, 2 or 3). Engine 3 is the most accurate.",
        "isTable: enable if the image contains tabular data.",
        "Use OCR: enable OCR recognition before sending to AI.",
        "Currency: select the currency to display next to prices.",
        "OCR Key: enter your OCR Space API key.",
        "AI Key: enter your Gemini or Groq API key.",
        "Use Coupons: enable the coupon system.",
        "Value: monetary value required to earn one coupon.",
        "Threshold: percentage of coupon value within which the proximity alert triggers.",
        "Import (📁): load a .yml file with saved configurations.",
        "Export (↓): download current configurations as a .yml file.",
      ],
    },
    {
      title: "🔑 Gemini API Key",
      ordered: true,
      items: [
        ["Go to Google AI Studio: ", { text: "aistudio.google.com", href: "https://aistudio.google.com" }],
        "Sign in with your Google account.",
        "Click 'Get API key' in the left menu.",
        "Click 'Create API key' and select or create a Google Cloud project.",
        "Copy the generated key and paste it in the AI Key field in Options.",
      ],
      note: "⚠️ The free plan has limits on requests per minute and per day.",
    },
    {
      title: "🔑 Groq API Key",
      ordered: true,
      items: [
        ["Go to Groq Console: ", { text: "console.groq.com", href: "https://console.groq.com" }],
        "Create an account (you can use Google or GitHub).",
        "Click 'API Keys' in the left menu.",
        "Click 'Create API Key', give it a name and confirm.",
        "Copy the key immediately (shown only once) and paste it in the AI Key field.",
      ],
      note: "✅ The free plan offers 14,400 requests/day with Llama 3.",
    },
    {
      title: "🔑 OCR Space API Key",
      ordered: true,
      items: [
        ["Go to OCR Space: ", { text: "ocr.space/ocrapi", href: "https://ocr.space/ocrapi" }],
        "Click 'Register for free API key'.",
        "Enter your email and complete the registration.",
        "You will receive the key by email. Paste it in the OCR Key field.",
      ],
      note: "✅ The free plan allows 500 requests per day.",
    },
  ],
};

export const translations: Record<Lang, TutorialContent> = { it, en };

function renderPart(part: TutorialInlinePart): string {
  if (typeof part === "string") return part;
  return `<a href="${part.href}" target="_blank" rel="noopener noreferrer">${part.text}</a>`;
}

export function renderTutorial(lang: Lang): string {
  const content = translations[lang];
  return content.sections
    .map((section) => {
      const tag = section.ordered ? "ol" : "ul";
      const itemsHtml = section.items
        .map((item) => {
          if (Array.isArray(item)) {
            return `<li>${item.map(renderPart).join("")}</li>`;
          }
          return `<li>${renderPart(item)}</li>`;
        })
        .join("");
      const noteHtml = section.note
        ? `<p class="tutorial-note">${section.note}</p>`
        : "";
      return `<div class="tutorial-section"><h3>${section.title}</h3><${tag}>${itemsHtml}</${tag}>${noteHtml}</div>`;
    })
    .join("");
}

export function getOptionTooltips(lang: Lang): Record<string, string> {
  const content = translations[lang];
  const optSection = content.sections.find((s) => s.title.includes("Opzioni") || s.title.includes("Options"));
  if (!optSection) return {};
  const map: Record<string, string> = {};
  for (const item of optSection.items) {
    if (typeof item === "string") {
      const colonIdx = item.indexOf(":");
      if (colonIdx > 0) {
        const key = item.slice(0, colonIdx).replace(/\s*\(.*\)/, "").trim();
        map[key] = item.slice(colonIdx + 1).trim();
      }
    }
  }
  return map;
}
