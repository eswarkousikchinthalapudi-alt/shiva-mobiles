/**
 * Privacy note and warranty terms, in English and Telugu.
 * These are sensible defaults written in plain language. The shop owner
 * should read them and change anything that doesn't match how the shop works.
 */

export const LEGAL_UPDATED = "2026-09-29";

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

type Vars = { shop: string; phone: string; address: string; retentionDays: number };

export function privacyDoc(lang: "en" | "te", v: Vars): LegalDoc {
  const contact = [v.phone, v.address].filter(Boolean).join(", ");
  if (lang === "te") {
    return {
      title: "గోప్యతా వివరాలు",
      intro: `ఈ వెబ్‌సైట్‌ని ${v.shop} నడుపుతోంది. మేము ఏ వివరాలు తీసుకుంటాం, ఎందుకు, ఎంత కాలం ఉంచుతాం అనేది ఇక్కడ ఉంది.`,
      sections: [
        {
          heading: "మేము తీసుకునే వివరాలు",
          bullets: [
            "మీ ఫోన్ అమ్మడానికి అడిగినప్పుడు: మీ పేరు, మొబైల్ నంబర్, ఏరియా, పిన్‌కోడ్ (ఇస్తే), ఫోన్ వివరాలు, మీ జవాబులు, మీరు జోడించిన ఫోటోలు.",
            "ఫోన్ వచ్చినప్పుడు చెప్పమని అడిగితే: మీ పేరు, వాట్సాప్ నంబర్, మీకు కావాల్సిన ఫోన్, బడ్జెట్.",
            "మీరు ఫోన్ కొన్నప్పుడు: బిల్ మీద మీ పేరు, మొబైల్ నంబర్.",
            "ప్రతి ఫోన్ పేజీ ఎన్నిసార్లు చూశారో లెక్క మాత్రమే. పేర్లు లేవు, ఇతర వెబ్‌సైట్లలో మిమ్మల్ని ట్రాక్ చేయం. ప్రకటనల ట్రాకర్లు వాడం.",
            "స్పామ్ ఆపడానికి, ఫారమ్ వాడకం గురించి చిన్న రికార్డ్ (మీ IP అడ్రస్‌ని కోడ్‌గా మార్చి) కొద్ది రోజులు ఉంచుతాం.",
          ],
        },
        {
          heading: "ఎందుకు వాడతాం",
          paragraphs: [
            "మీ రిక్వెస్ట్‌కి జవాబు ఇవ్వడానికి, మీ బిల్, వారంటీ కార్డ్ తయారు చేయడానికి, వెబ్‌సైట్ సురక్షితంగా ఉంచడానికి మాత్రమే. మీ వివరాలను ఎవరికీ అమ్మం, ప్రకటనల కోసం ఇవ్వం.",
          ],
        },
        {
          heading: "ఎవరు చూడగలరు",
          paragraphs: [
            "షాప్ యజమాని, సిబ్బంది మాత్రమే. వాళ్ళు పాస్‌వర్డ్, 2-స్టెప్ లాగిన్ ఉన్న అడ్మిన్ ప్యానెల్ ద్వారా చూస్తారు. మా హోస్టింగ్ సంస్థ మా తరఫున డేటాని భద్రంగా ఉంచుతుంది.",
          ],
        },
        {
          heading: "ఎంత కాలం ఉంచుతాం",
          bullets: [
            'ఫోన్ కోసం "నాకు తెలియజేయండి" రిక్వెస్ట్‌లు: 90 రోజుల తర్వాత తొలగిస్తాం.',
            `ఫోన్ అమ్మే రిక్వెస్ట్‌లు, ఫోటోలు: చివరి అప్‌డేట్ తర్వాత ${v.retentionDays} రోజులకు తొలగిస్తాం.`,
            "బిల్లులు: అమ్మకాల రికార్డులు ఉంచాలని చట్టం చెప్పినంత కాలం.",
            "షాప్ అడ్మిన్ ప్యానెల్‌లో తప్పు లాగిన్ ప్రయత్నాలు (IP అడ్రస్‌తో): భద్రత కోసం 90 రోజులు.",
          ],
        },
        {
          heading: "మీ హక్కులు",
          paragraphs: [
            `మీ వివరాలు చూడాలన్నా, సరిచేయాలన్నా, తొలగించాలన్నా ఎప్పుడైనా అడగండి. వాట్సాప్ లేదా కాల్ చేయండి, లేదా షాప్‌కి రండి${contact ? ` (${contact})` : ""}. 7 రోజుల్లో చేస్తాం. మీకు ఏదైనా ఫిర్యాదు ఉంటే కూడా ఇదే నంబర్‌కి చెప్పండి.`,
          ],
        },
        {
          heading: "కుకీలు",
          paragraphs: ["మీరు ఎంచుకున్న భాషను గుర్తుంచుకోవడానికి ఒక చిన్న కుకీ మాత్రమే వాడతాం. అడ్మిన్ ప్యానెల్‌కి లాగిన్ కుకీ ఉంటుంది. ప్రకటనల కుకీలు లేవు."],
        },
      ],
    };
  }
  return {
    title: "Privacy note",
    intro: `${v.shop} runs this website. This note explains what we collect, why, and how long we keep it.`,
    sections: [
      {
        heading: "What we collect",
        bullets: [
          "When you ask to sell a phone: your name, mobile number, area, pincode (if you give it), the phone's details, your answers and any photos you add.",
          "When you ask us to tell you about a phone: your name, WhatsApp number, the phone you want and your budget.",
          "When you buy a phone: your name and mobile number on the bill.",
          "How many times each phone page is seen. No names, and no tracking across other websites. We don't use advertising trackers.",
          "To stop spam, a short record of form use (with your IP address turned into a code) for a few days.",
        ],
      },
      {
        heading: "Why we use it",
        paragraphs: [
          "Only to reply to your request, to make your bill and warranty card, and to keep the website safe. We never sell your details or give them to anyone for advertising.",
        ],
      },
      {
        heading: "Who can see it",
        paragraphs: [
          "Only the shop owner and staff, through an admin panel protected by a password and 2-step login. Our hosting company stores the data safely for us.",
        ],
      },
      {
        heading: "How long we keep it",
        bullets: [
          '"Notify me" requests: deleted after 90 days.',
          `Sell requests and their photos: deleted ${v.retentionDays} days after the last update.`,
          "Bills: kept for as long as the law asks shops to keep sales records.",
          "Failed attempts to log in to the shop's admin panel (with the IP address): 90 days, for security.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          `You can ask to see, correct or delete your details at any time. WhatsApp or call us, or visit the shop${contact ? ` (${contact})` : ""}. We will do it within 7 days. Use the same number for any complaint about your data.`,
        ],
      },
      {
        heading: "Cookies",
        paragraphs: ["We use one small cookie to remember your language. The admin panel uses a login cookie. There are no advertising cookies."],
      },
    ],
  };
}

export function termsDoc(lang: "en" | "te", v: Vars): LegalDoc {
  if (lang === "te") {
    return {
      title: "వారంటీ, రిటర్న్స్",
      intro: `${v.shop}లో అమ్మే ప్రతి ఫోన్ IMEI ని ప్రభుత్వ డేటాబేస్‌లో చెక్ చేస్తాం, 12 పాయింట్లు టెస్ట్ చేస్తాం. వారంటీ, రిటర్న్స్ ఇలా పని చేస్తాయి.`,
      sections: [
        {
          heading: "షాప్ వారంటీ",
          paragraphs: [
            "మీ బిల్ మీద రాసిన నెలల వరకు, బిల్ తేదీ నుంచి, పని చేసే భాగాల్లో లోపాలకు వారంటీ ఉంటుంది: టచ్, డిస్‌ప్లే, స్పీకర్, మైక్, కెమెరాలు, ఛార్జింగ్ పోర్ట్, నెట్‌వర్క్, బటన్లు.",
          ],
        },
        {
          heading: "వారంటీ వర్తించనివి",
          bullets: [
            "కింద పడటం, పగలడం, వంగడం వంటి డ్యామేజ్.",
            "నీరు లేదా తేమ వల్ల డ్యామేజ్.",
            "బయట తెరిచిన లేదా రిపేర్ చేయించిన ఫోన్లు.",
            "యాప్‌ల వల్ల వచ్చే సాఫ్ట్‌వేర్ సమస్యలు.",
            "ఫోన్ వయసుకి తగ్గట్టు బ్యాటరీ తగ్గడం.",
          ],
        },
        {
          heading: "వారంటీ ఎలా పొందాలి",
          paragraphs: [
            "ఫోన్, బిల్ (లేదా బిల్ నంబర్) తీసుకుని షాప్‌కి రండి. మేము చెక్ చేసి లోపం ఉన్న భాగం రిపేర్ చేస్తాం లేదా మారుస్తాం. రిపేర్ కుదరకపోతే, అదే విలువ ఉన్న ఫోన్ లేదా మరో న్యాయమైన పరిష్కారం ఇస్తాం.",
          ],
        },
        {
          heading: "3 రోజుల్లో రిటర్న్",
          paragraphs: [
            "ఫోన్ హెల్త్ రిపోర్ట్‌లో రాసినట్టు లేకపోతే, 3 రోజుల్లోపు ఫోన్, బిల్ తీసుకుని రండి. సరిచేస్తాం లేదా ఫోన్ వెనక్కి తీసుకుంటాం. డబ్బు కట్టే ముందు షాప్‌లోనే ఫోన్‌ని బాగా చెక్ చేసుకోండి.",
          ],
        },
        {
          heading: "మాకు ఫోన్ అమ్మేటప్పుడు",
          bullets: [
            "వెబ్‌సైట్‌లో చూపే ధర అంచనా మాత్రమే. ఫోన్‌ని నేరుగా చెక్ చేశాకే ఫైనల్ ధర.",
            "ఒక గుర్తింపు కార్డ్ (ID ప్రూఫ్) తీసుకురండి.",
            "కొనే ముందు ఫోన్ IMEI ని ప్రభుత్వ డేటాబేస్‌లో చెక్ చేస్తాం. పోయిన లేదా బ్లాక్ అయిన ఫోన్లు కొనం.",
          ],
        },
        {
          heading: "ధరలు",
          paragraphs: ["వెబ్‌సైట్‌లో ధరలు మారవచ్చు. మీ బిల్ మీద ఉన్న ధరే ఫైనల్."],
        },
      ],
    };
  }
  return {
    title: "Warranty and returns",
    intro: `Every phone sold by ${v.shop} has its IMEI checked in the government database and is tested on 12 points. This is how warranty and returns work.`,
    sections: [
      {
        heading: "Shop warranty",
        paragraphs: [
          "For the number of months written on your bill, starting from the bill date, we cover faults in working parts: touch, display, speaker, mic, cameras, charging port, network and buttons.",
        ],
      },
      {
        heading: "Not covered",
        bullets: [
          "Damage from drops, cracks or bends.",
          "Water or moisture damage.",
          "Phones opened or repaired somewhere else.",
          "Software problems caused by apps.",
          "Battery wear that is normal for the phone's age.",
        ],
      },
      {
        heading: "How to claim",
        paragraphs: [
          "Bring the phone and your bill (or bill number) to the shop. We check it and repair or replace the faulty part. If it can't be repaired, we will offer a phone of similar value or another fair solution.",
        ],
      },
      {
        heading: "3-day return",
        paragraphs: [
          "If the phone is not as described in its health report, bring it back with the bill within 3 days. We will fix it or take it back. Please check the phone well in the shop before you pay.",
        ],
      },
      {
        heading: "Selling your phone to us",
        bullets: [
          "The price on the website is an estimate. The final price is decided after we check the phone in person.",
          "Please bring an ID proof.",
          "We check the phone's IMEI in the government database before buying. We don't buy lost or blocked phones.",
        ],
      },
      {
        heading: "Prices",
        paragraphs: ["Prices on the website can change. The price on your bill is final."],
      },
    ],
  };
}
