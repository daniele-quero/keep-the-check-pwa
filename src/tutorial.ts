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
        "L'immagine ritagliata viene inviata automaticamente al gateway IA server-side, che restituisce i risultati strutturati (prodotto, prezzo, valuta, tipo e confidence).",
        "Quando è richiesta la revisione, la modale mostra i campi AI ridimensionati: puoi modificare prodotto, prezzo, valuta e tipo, scegliere la quantità, deselezionare o eliminare le righe.",
        "Premi ✓ (Conferma) per salvare gli articoli nella lista; premi ✗ (Annulla) per scartare il risultato senza modificare la lista.",
      ],
      note: "🔒 Privacy: l'immagine lascia il dispositivo solo quando avvii la scansione e viene inviata al proxy Netlify, che la inoltra al gateway IA configurato server-side. Le chiavi non vengono mai esposte nel browser.",
    },
    {
      title: "➕ Inserimento manuale",
      items: [
        "Premi il pulsante + per aprire la modale di inserimento manuale.",
        "Inserisci il nome del prodotto e il prezzo unitario.",
        "Usa i pulsanti − / + nella modale per impostare la quantità desiderata prima di confermare.",
        "Conferma con ✓ o annulla con ✗.",
      ],
      note: "💡 L'inserimento manuale è anche il fallback quando l'IA non è disponibile (configurazione server-side assente, gateway non raggiungibile, timeout o errore di analisi): i campi manuali tornano disponibili automaticamente.",
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
        "Require Manual Confirm: se abilitato, dopo l'analisi IA si apre la modale di revisione; se disabilitato, un risultato singolo con confidence valide viene aggiunto automaticamente alla lista.",
        "Use Coupons: attiva il sistema coupon.",
        "Value: valore in denaro per guadagnare un coupon.",
        "Threshold: percentuale del valore coupon entro cui scatta l'alert di avvicinamento.",
        "AI Analysis: l'app usa sempre il modello fisso auto:vision configurato lato server; non è presente alcuna selezione del modello nel browser.",
        "Import (📁): carica un file .yml con le configurazioni salvate.",
        "Export (↓): scarica le configurazioni attuali come file .yml.",
      ],
    },
    {
      title: "🔒 Configurazione server-side IA",
      ordered: true,
      items: [
        "L'app usa sempre il modello fisso auto:vision per l'analisi delle immagini.",
        "Imposta `AI_GATEWAY_VISION_URL` e `AI_GATEWAY_VISION_KEY` in Netlify Environment Variables oppure nel file .env locale.",
        "La chiave e il modello non vengono mai salvati nel browser: tutto il routing passa attraverso il proxy Netlify.",
        "Durante la scansione, la UI mostra un spinner finché la risposta del gateway non torna completa.",
      ],
      note: "⚠️ Nessuna chiave, endpoint o modello è esposto nelle opzioni del browser. La sicurezza e la configurazione restano totalmente server-side.",
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
        "The cropped image is automatically sent to the server-side AI gateway, which returns structured results (product, price, currency, type and confidence).",
        "When review is required, the modal shows compact AI fields: you can edit the product, price, currency and type, set the quantity, uncheck or delete rows.",
        "Press ✓ (Confirm) to save the items to the list; press ✗ (Cancel) to discard the result without modifying the list.",
      ],
      note: "🔒 Privacy: the image leaves your device only when you trigger a scan and is sent to the Netlify proxy, which forwards it to the server-side AI gateway. Keys are never exposed in the browser.",
    },
    {
      title: "➕ Manual Entry",
      items: [
        "Press the + button to open the manual entry modal.",
        "Enter the product name and unit price.",
        "Use the − / + buttons in the modal to set the desired quantity before confirming.",
        "Confirm with ✓ or cancel with ✗.",
      ],
      note: "💡 Manual entry is also the fallback when the AI is unavailable (missing server-side configuration, unreachable gateway, timeout or analysis error): the manual fields become available automatically.",
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
        "Require Manual Confirm: when enabled, after AI analysis the review modal opens; when disabled, a single result with valid confidence values is added automatically to the list.",
        "Use Coupons: enable the coupon system.",
        "Value: monetary value required to earn one coupon.",
        "Threshold: percentage of coupon value within which the proximity alert triggers.",
        "AI Analysis: the app always uses the fixed auto:vision model configured on the server; there is no model picker in the browser.",
        "Import (📁): load a .yml file with saved configurations.",
        "Export (↓): download current configurations as a .yml file.",
      ],
    },
    {
      title: "🔒 Server-side AI configuration",
      ordered: true,
      items: [
        "The app always uses the fixed auto:vision model for image analysis.",
        "Set `AI_GATEWAY_VISION_URL` and `AI_GATEWAY_VISION_KEY` in Netlify Environment Variables or in your local .env file.",
        "The key and model are never stored in the browser: all routing goes through the Netlify proxy.",
        "While scanning, the UI shows a spinner until the gateway response is complete.",
      ],
      note: "⚠️ No key, endpoint or model is exposed in the browser options. Security and configuration remain fully server-side.",
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
