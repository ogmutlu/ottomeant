import type { Role, Root } from "./model.js";

/** A proposal describes a possible interpretation; it does not assert lexical existence. */
export interface MeaningProposal {
  readonly definition: string;
  readonly example: string;
}

const processes: Readonly<Record<string, string>> = {
  كتب: "yazma",
  علم: "bilme ve öğrenme",
  درس: "ders çalışma ve inceleme",
  فتح: "açma",
  حكم: "yargılama ve karar verme",
  عمل: "iş yapma",
  نظر: "bakma ve gözlemleme",
  حفظ: "koruma ve saklama",
  سلم: "esenlik sağlama",
  خلق: "yaratma",
  شكر: "teşekkür etme",
  صبر: "sabretme",
};

export function proposeMeaning(
  root: Root,
  role: Role,
  word: string,
  verbalFunction?: string,
): MeaningProposal {
  const process =
    processes[root.key] ??
    (root.custom
      ? "henüz anlamı belirlenmemiş bu eylem"
      : `${root.title.replace(/ ailesi$/, "")} kavramıyla bağlantılı eylem`);
  const limitation = !root.custom
    ? ""
    : " Kökün anlamı bilinmediğinden bu öneri yalnızca rolü açıklar.";
  const meanings: Readonly<Record<Role, string>> = {
    agent: `${process} eylemini gerçekleştiren kişi veya varlık`,
    patient: `${process} eyleminden etkilenmiş kişi veya nesne`,
    theme: `${process} sürecinin ürünü veya ele aldığı konu`,
    action: `${process} eyleminin kendisi veya gerçekleşme süreci`,
    place: `${process} eyleminin gerçekleştiği yer`,
    instrument: `${process} eylemini gerçekleştirmeye yarayan araç`,
    quality: `${process} eylemiyle ilişkili, süreklilik gösteren nitelik`,
    verbs: `${process} eylemine uygulanan ${verbalFunction?.toLocaleLowerCase("tr") ?? "türetme"} işlevi`,
  };
  const examples: Readonly<Record<Role, string>> = {
    agent: `Araştırma heyetindeki ${word}, ${process} sürecinde kullanılan yöntemleri karşılaştırıp aynı sonuca ulaşan ekiplerin farklı varsayımlardan hareket ettiğini ortaya koyuyordu.`,
    patient: `İşlemden sonra ${word}, önceki durumuyla karşılaştırılarak ${process} sürecinin hangi değişikliklere yol açtığını gösteriyordu.`,
    theme: `Arşivde tutulan ${word}, ${process} sürecinin yalnızca sonucunu değil, sonuca götüren kararları da incelemeyi mümkün kılıyordu.`,
    action: `Uzun süren ${word}, ${process} sırasında ortaya çıkan hatalar düzeltilmeden aynı işlemi tekrarlamanın yeterli olmadığını gösterdi.`,
    place: `Bölgedeki ${word}, ${process} için gerekli araçları bir araya getirerek farklı ekiplerin aynı yöntemle çalışmasını sağlıyordu.`,
    instrument: `Atölyede kullanılan ${word}, ${process} sırasında elle fark edilemeyen sapmaları görünür kılarak hatalı sonuçların tekrarını önlüyordu.`,
    quality: `Kurul, ${word} niteliğinin yalnızca olumlu sonuçlarda değil, ${process} sırasında karşılaşılan güçlükler altında da korunup korunmadığını inceledi.`,
    verbs: `Deney protokolündeki ${word} adımı, ${process} işlemini ${verbalFunction?.toLocaleLowerCase("tr") ?? "türetme"} işlevine göre yeniden düzenleyerek önceki aşamadan farklı bir sonuç elde edilmesini sağlıyordu.`,
  };
  return {
    definition: `Bu sözcük var olsaydı, ${meanings[role]} anlamına gelebilirdi.${limitation}`,
    example: examples[role],
  };
}
