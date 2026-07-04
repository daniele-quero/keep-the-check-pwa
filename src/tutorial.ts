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
        "Inquadra etichette o scontrini con la fotocamera: l'immagine viene analizzata automaticamente tramite intelligenza artificiale (IA) per estrarre prezzi e nomi prodotto.",
        "Il totale viene aggiornato in tempo reale man mano che aggiungi articoli.",
      ],
    },
    {
      title: "📷 Scansione",
      items: [
        "Premi il pulsante SCAN (icona fotocamera) per acquisire un frame dalla fotocamera.",
        "Usa lo slider per regolare il crop verticale dell'immagine: le maschere pesca indicano la zona esclusa dalla scansione.",
        "L'immagine ritagliata viene inviata automaticamente all'IA configurata, che restituisce uno o più risultati strutturati (prodotto, prezzo, valuta).",
        "Se serve revisione manuale o fallback, si apre una modale dove puoi rivedere e modificare i risultati: aggiungi, modifica o elimina righe.",
        "Premi Conferma per salvare gli articoli nella lista; Annulla per scartare il risultato senza modificare la lista.",
      ],
      note: "🔒 Privacy: l'immagine lascia il dispositivo solo quando avvii la scansione e viene inviata esclusivamente all'endpoint IA che hai configurato nelle Opzioni (oppure al proxy se l'hai abilitato). Nessun altro server riceve l'immagine.",
    },
    {
      title: "➕ Inserimento manuale",
      items: [
        "Premi il pulsante + per aprire la modale di inserimento manuale.",
        "Inserisci il nome del prodotto e il prezzo unitario.",
        "Usa i pulsanti − / + nella modale per impostare la quantità desiderata prima di confermare.",
        "Conferma con ✓ o annulla con ✗.",
      ],
      note: "💡 L'inserimento manuale è anche il fallback quando l'IA non è disponibile (chiave assente, endpoint non raggiungibile, timeout o errore di analisi): dalla modale di scansione puoi passare alla modalità manuale con un solo click.",
    },
    {
      title: "📋 Lista articoli",
      items: [
        "Ogni riga mostra: nome prodotto, prezzo totale (unitario × quantità), pulsanti − / + per la quantità, pulsante × per rimuovere l'articolo.",
        "Il numero centrale indica la quantità: usa − e + per modificarla senza rimuovere l'articolo.",
        "La quantità minima è 1: il pulsante − non ha effetto al di sotto di questo valore.",
        "Gli articoli in rosso indicano un errore di analisi.",
        "Tocca il nome del prodotto per aprire la modale di modifica con i valori precompilati: puoi aggiornare nome, prezzo e quantità. La conferma aggiornerà l'articolo senza aggiungerne un altro.",
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
        "Currency: seleziona la valuta da visualizzare accanto ai prezzi.",
        "AI Image Endpoint: URL dell'API IA che riceve l'immagine e restituisce i prezzi strutturati (es. endpoint OpenAI Vision, Gemini Vision, o un proxy).",
        "AI Image Model: identificatore del modello da usare (es. gpt-4o-mini, gemini-1.5-flash).",
        "AI Image Key: API key dell'endpoint IA per l'analisi dell'immagine. È salvata solo nel tuo browser: non condividerla e non committarla.",
        "AI Image Timeout: millisecondi di attesa massima per la risposta dell'IA prima di annullare la chiamata.",
        "Use Image Proxy: se abilitato, l'immagine viene inviata a /ai-proxy (configurato lato server) invece che all'endpoint diretto; usalo per non esporre la chiave nel browser.",
        "Require Manual Confirm: se abilitato, dopo l'analisi IA si apre la modale di revisione; se disabilitato, gli articoli rilevati vengono aggiunti automaticamente alla lista.",
        "Use Coupons: attiva il sistema coupon.",
        "Value: valore in denaro per guadagnare un coupon.",
        "Threshold: percentuale del valore coupon entro cui scatta l'alert di avvicinamento.",
        "Import (📁): carica un file .yml con le configurazioni salvate.",
        "Export (↓): scarica le configurazioni attuali come file .yml.",
      ],
    },
    {
      title: "🔑 API key per l'Analisi IA dell'immagine",
      ordered: true,
      items: [
        "Scegli un provider che esponga un'API IA con supporto immagini (es. OpenAI, Google Gemini, un servizio compatibile o un tuo proxy).",
        "Consulta la documentazione del provider per generare una API key dedicata all'endpoint immagini.",
        "Apri le Opzioni e incolla l'URL completo dell'endpoint nel campo AI Image Endpoint, il nome del modello in AI Image Model e la chiave in AI Image Key.",
        "Se hai un proxy lato server che inietta la chiave, abilita Use Image Proxy e lascia il campo AI Image Key vuoto.",
        "Conferma con ✓: la configurazione viene salvata solo nel tuo browser (localStorage).",
      ],
      note: "⚠️ La chiave è memorizzata solo nel tuo browser. Non condividerla, non committarla in repository e non incollarla in chat o screenshot.",
    },
  ],
};

const en: TutorialContent = {
  sections: [
    {
      title: "🎯 App Purpose",
      items: [
        "Keep The Check helps you track prices while shopping.",
        "Point your camera at price tags or receipts: the image is automatically analyzed by AI to extract prices and product names.",
        "The total updates in real time as you add items.",
      ],
    },
    {
      title: "📷 Scanning",
      items: [
        "Press the SCAN button (camera icon) to capture a frame from the camera.",
        "Use the slider to crop the image vertically: the peach masks show the excluded area.",
        "The cropped image is automatically sent to the configured AI, which returns one or more structured results (product, price, currency).",
        "When manual review or fallback is needed, a modal opens where you can review and edit the results: add, edit or delete rows.",
        "Press Confirm to save the items to the list; Cancel to discard the result without modifying the list.",
      ],
      note: "🔒 Privacy: the image leaves your device only when you trigger a scan and is sent exclusively to the AI endpoint you configured in Options (or to your proxy if enabled). No other server receives the image.",
    },
    {
      title: "➕ Manual Entry",
      items: [
        "Press the + button to open the manual entry modal.",
        "Enter the product name and unit price.",
        "Use the − / + buttons in the modal to set the desired quantity before confirming.",
        "Confirm with ✓ or cancel with ✗.",
      ],
      note: "💡 Manual entry is also the fallback when the AI is unavailable (missing key, unreachable endpoint, timeout or analysis error): from the scan modal you can switch to manual mode with one click.",
    },
    {
      title: "📋 Item List",
      items: [
        "Each row shows: product name, total price (unit × quantity), − / + buttons for quantity, × button to remove.",
        "The central number shows the quantity: use − and + to change it without removing the item.",
        "Minimum quantity is 1: the − button has no effect below this value.",
        "Items in red indicate an analysis error.",
        "Tap the product name to open the edit modal with pre-filled values: you can update the name, price and quantity. Confirming will update the item without adding a new one.",
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
        "Currency: select the currency to display next to prices.",
        "AI Image Endpoint: URL of the AI API that receives the image and returns structured prices (e.g. OpenAI Vision endpoint, Gemini Vision, or a proxy).",
        "AI Image Model: identifier of the model to use (e.g. gpt-4o-mini, gemini-1.5-flash).",
        "AI Image Key: API key for the image-analysis AI endpoint. It is stored only in your browser: do not share or commit it.",
        "AI Image Timeout: maximum milliseconds to wait for the AI response before aborting the call.",
        "Use Image Proxy: when enabled, the image is sent to /ai-proxy (configured server-side) instead of the direct endpoint; use it to avoid exposing the key in the browser.",
        "Require Manual Confirm: when enabled, after AI analysis the review modal opens; when disabled, detected items are added to the list automatically.",
        "Use Coupons: enable the coupon system.",
        "Value: monetary value required to earn one coupon.",
        "Threshold: percentage of coupon value within which the proximity alert triggers.",
        "Import (📁): load a .yml file with saved configurations.",
        "Export (↓): download current configurations as a .yml file.",
      ],
    },
    {
      title: "🔑 Image AI Analysis API Key",
      ordered: true,
      items: [
        "Pick a provider that exposes an AI API with image support (e.g. OpenAI, Google Gemini, a compatible service, or your own proxy).",
        "Check the provider's documentation to generate an API key dedicated to the image endpoint.",
        "Open Options and paste the full endpoint URL into AI Image Endpoint, the model name into AI Image Model, and the key into AI Image Key.",
        "If you run a server-side proxy that injects the key, enable Use Image Proxy and leave the AI Image Key field empty.",
        "Confirm with ✓: the configuration is saved only in your browser (localStorage).",
      ],
      note: "⚠️ The key is stored only in your browser. Do not share it, do not commit it to a repository, and do not paste it into chats or screenshots.",
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
