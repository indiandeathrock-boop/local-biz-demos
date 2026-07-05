// 人間診断チェックシートの項目定義。
// 出典: gbp-human-diagnosis-tool.html（2026-07-05版）。項目・配点・アンカー・
// チェックリストのstep計算・判定不能トグルの仕様をそのまま移植している。
// gbp-scoring-rules.md の人間診断基準が更新されたら、このファイルだけを修正する。

export type RadioSub = {
  id: string;
  kind: "radio";
  title: string;
  followup?: string;
  options: { label: string; pts: number }[];
  hint?: string;
};

export type ChecklistSub = {
  id: string;
  kind: "checklist";
  title: string;
  items: string[];
  max: number;
  step: number;
  hint?: string;
};

export type SubItem = RadioSub | ChecklistSub;

export type Section = {
  id: string;
  title: string;
  max: number;
  part: 1 | 2;
  hint?: string;
  intro?: string;
  na?: { label: string; targetSubIds: string[] };
  subs: SubItem[];
  memoPlaceholder?: string;
};

export const HUMAN_SECTIONS: Section[] = [
  {
    id: "s1",
    title: "1. 投稿の頻度と質",
    max: 20,
    part: 1,
    subs: [
      {
        id: "1-1",
        kind: "radio",
        title: "1-1. 直近3か月の投稿頻度",
        options: [
          { label: "月4回以上", pts: 8 },
          { label: "月2〜3回", pts: 5 },
          { label: "月1回", pts: 3 },
          { label: "直近30日投稿なし", pts: 1 },
          { label: "投稿機能を使っていない", pts: 0 },
        ],
        hint: "※30日以上更新がないと鮮度低下により視認性が下がる傾向（2026年知見）。「直近30日」を最重視。",
      },
      {
        id: "1-2",
        kind: "checklist",
        title: "1-2. ライティングの質（直近投稿3件を確認。当てはまる要素にチェック）",
        items: [
          "対象者を絞った呼びかけ（「〇〇したい、でも▲▲な方へ」）",
          "APSORA構成（呼びかけ→問題提起→解決策→安心→行動喚起）",
          "主語がお客様（「当店は〜」でなく「（あなたは）●●できる」）",
          "想い・理由・エピソードの具体性",
          "五感表現・オノマトペの活用",
        ],
        max: 8,
        step: 2,
        hint: "5要素中4つ以上=8／2〜3=5／1つ=2／単なる告知文=0（自動計算）",
      },
      {
        id: "1-3",
        kind: "radio",
        title: "1-3. 誘導ボタン（クロージング）",
        options: [
          { label: "ほぼ全投稿にボタン設置・導線あり", pts: 4 },
          { label: "一部の投稿のみ", pts: 2 },
          { label: "ボタンなし", pts: 0 },
        ],
      },
    ],
  },
  {
    id: "s2",
    title: "2. クチコミ返信",
    max: 20,
    part: 1,
    hint: "2026年のアルゴリズムはPopularity（エンゲージメント）重視。返信の有無が重要度上昇。",
    na: {
      label: "この店舗には低評価クチコミが存在しない（2-3を判定不能にする）",
      targetSubIds: ["2-3"],
    },
    subs: [
      {
        id: "2-1",
        kind: "radio",
        title: "2-1. 返信率（直近20件、20件未満なら全件）",
        options: [
          { label: "100%（星だけ評価にも返信）", pts: 8 },
          { label: "80%以上", pts: 6 },
          { label: "50%以上", pts: 4 },
          { label: "散発的", pts: 2 },
          { label: "返信なし", pts: 0 },
        ],
      },
      {
        id: "2-2",
        kind: "checklist",
        title: "2-2. 高評価返信の質（3件確認。当てはまる要素にチェック）",
        items: [
          "定型文コピペでない",
          "お客様の「目のつけどころ」への言及がある",
          "さりげなく別の魅力をPRしている",
        ],
        max: 6,
        step: 2,
      },
      {
        id: "2-3",
        kind: "radio",
        title:
          "2-3. 低評価対応（感謝→心情理解と謝罪→理由説明→善後策、倍程度の丁寧さ）",
        options: [
          { label: "タブーを犯さず、丁寧に対応できている", pts: 6 },
          { label: "返信はあるが形式的", pts: 3 },
          {
            label: "タブー（感情的反論・謝らない・プライバシー言及等）を犯している",
            pts: 0,
          },
        ],
      },
    ],
  },
  {
    id: "s3",
    title: "3. 写真の質",
    max: 15,
    part: 1,
    hint: "写真の「量」は自動診断側で採点済み。ここでは質のみ。",
    subs: [
      {
        id: "3-1",
        kind: "radio",
        title: "3-1. カバー写真とロゴ",
        options: [
          { label: "両方適切", pts: 4 },
          { label: "片方のみ適切", pts: 2 },
          { label: "両方不備（デフォルト画像・不鮮明等）", pts: 0 },
        ],
      },
      {
        id: "3-2",
        kind: "checklist",
        title: "3-2. 写真の多様性（当てはまるカテゴリにチェック）",
        items: ["外観", "内観・客席全体", "商品・サービス", "スタッフ", "駐車場・アクセス", "設備"],
        max: 6,
        step: 1.2,
        hint: "5種類以上=6／3〜4=4／2=2／1種類のみ=1（自動計算）",
      },
      {
        id: "3-3",
        kind: "radio",
        title: "3-3. 不安解消の構図と見栄え",
        options: [
          { label: "構図・加工とも良好", pts: 5 },
          { label: "どちらか一方のみ良好", pts: 3 },
          { label: "暗い・傾いた写真が目立つ", pts: 1 },
        ],
      },
    ],
  },
  {
    id: "s4",
    title: "4. 説明文・商品説明の訴求力",
    max: 15,
    part: 1,
    subs: [
      {
        id: "4-1",
        kind: "checklist",
        title: "4-1. 説明文（ビジネス情報の「説明」欄。当てはまる要素にチェック）",
        items: [
          "具体的な特徴・強みが書かれている（抽象的な挨拶文でない）",
          "主語がお客様（「●●できる」表現）",
          "お客様の不安・疑問への言及（料金・利用手順・アフターケア等）",
          "お店の特徴を表すキーワードの一貫した使用",
        ],
        max: 8,
        step: 2,
      },
      {
        id: "4-2",
        kind: "checklist",
        title: "4-2. 商品・サービスの説明（登録済みのものを確認。当てはまる要素にチェック）",
        items: [
          "カテゴリ分けの整理",
          "税込価格の明記",
          "詳細な説明文（タイトル・写真だけでない）",
          "魅力的な写真",
          "リンクURL",
        ],
        max: 7,
        step: 1.4,
        hint: "商品・サービスの登録自体がない場合はすべて未チェックのままでOK（0点）",
      },
    ],
  },
  {
    id: "s5",
    title: "5. 外部連携（自社HP・SNS・ローカルSEO）",
    max: 10,
    part: 1,
    subs: [
      {
        id: "5-1",
        kind: "radio",
        title: "5-1. 自社HPの充実度",
        options: [
          { label: "独自コンテンツ（事例・お客様の声等）があり更新されている", pts: 4 },
          { label: "HPはあるが名刺代わりの静的サイト", pts: 2 },
          { label: "リンク切れ・HPなし", pts: 0 },
        ],
      },
      {
        id: "5-2",
        kind: "radio",
        title: "5-2. SNS連携",
        options: [
          { label: "2つ以上を活発運用", pts: 3 },
          { label: "1つ運用", pts: 2 },
          { label: "アカウントはあるが放置", pts: 1 },
          { label: "なし", pts: 0 },
        ],
      },
      {
        id: "5-3",
        kind: "radio",
        title: "5-3. 情報の一貫性（NAP：店名・住所・電話）",
        options: [
          { label: "完全一致", pts: 3 },
          { label: "軽微な表記ゆれ", pts: 2 },
          { label: "不一致・旧情報の放置あり", pts: 0 },
        ],
      },
    ],
  },
  {
    id: "s6",
    title: "6. アカウント体制",
    max: 10,
    part: 2,
    hint: "導入例:「管理まわりについて、いくつか教えてください。普段どなたが更新されていますか？」",
    subs: [
      {
        id: "6-1",
        kind: "radio",
        title:
          "Q1.「お店専用のGoogleアカウントで管理されていますか？それとも個人のアカウントですか？」",
        options: [
          { label: "専用アカウント", pts: 2 },
          { label: "個人アカウントだが引き継ぎ可能", pts: 1 },
          { label: "退職者・不明な個人アカウント", pts: 0 },
        ],
      },
      {
        id: "6-2",
        kind: "radio",
        title: "Q2.「オーナー確認はお済みですか？」",
        followup: "追い聞き:「動画での再確認を求められたら対応できそうですか？」",
        options: [
          { label: "確認済み＋動画認証済みor対応可能", pts: 4 },
          { label: "確認済みだが動画対応は不安", pts: 3 },
          { label: "確認済みか不明", pts: 1 },
          { label: "未確認", pts: 0 },
        ],
      },
      {
        id: "6-3",
        kind: "radio",
        title: "Q3.「更新できる方は何名いますか？」",
        followup: "追い聞き:「お休みや退職のとき、更新は止まりませんか？」",
        options: [
          { label: "2名以上・相互チェックあり", pts: 4 },
          { label: "2名以上いるが実質1名運用", pts: 2 },
          { label: "完全に1名", pts: 1 },
          { label: "誰も分からない", pts: 0 },
        ],
      },
    ],
  },
  {
    id: "s7",
    title: "7. インサイト分析",
    max: 10,
    part: 2,
    hint: "導入例:「『パフォーマンス』という数字を見られる場所、ご覧になったことはありますか？」",
    memoPlaceholder:
      "メモ（任意）：可能なら面談時に管理画面を一緒に開いてもらうと裏付けが取れます",
    subs: [
      {
        id: "7-1",
        kind: "radio",
        title:
          "Q4.「ルート検索数や電話・ウェブクリック数、どのくらいの頻度で確認されますか？」",
        options: [
          { label: "月1回以上、推移として見ている", pts: 4 },
          { label: "たまに見る", pts: 2 },
          { label: "見たことはある", pts: 1 },
          { label: "存在を知らない", pts: 0 },
        ],
      },
      {
        id: "7-2",
        kind: "radio",
        title:
          "Q5.「どんな言葉で検索されてお店にたどり着いているか、見たことはありますか？」",
        options: [
          { label: "確認し施策に活かした経験がある", pts: 3 },
          { label: "見たことはあるが活用していない", pts: 1 },
          { label: "知らない", pts: 0 },
        ],
      },
      {
        id: "7-3",
        kind: "radio",
        title: "Q6.「その数字を見て、投稿や写真、メニューを変えたことはありますか？」",
        options: [
          { label: "数字を根拠に施策を変えた具体例がある", pts: 3 },
          { label: "変えようと思ったが未実行", pts: 1 },
          { label: "数字と施策が結びついていない", pts: 0 },
        ],
      },
    ],
  },
];

// 採点外メモ（配点なし・改善提案の材料）
export const EXTRA_MEMOS = [
  "クチコミ依頼の仕組み（声がけ・POP・メール/LINE等）",
  "低評価・クレーム意見の社内共有の実態",
  "特別営業時間（年末年始・臨時休業）の更新運用",
  "HP・SNSの更新頻度・担当",
  "開業日・その他メモ",
];

export type HumanAnswers = {
  radios: Record<string, number>; // subId -> 選択肢index
  checks: Record<string, boolean[]>; // subId -> チェック状態
  naFlags: Record<string, boolean>; // sectionId -> 判定不能トグル
  memos: Record<string, string>; // sectionId or "extra-N" -> メモ
};

export const EMPTY_ANSWERS: HumanAnswers = { radios: {}, checks: {}, naFlags: {}, memos: {} };

// チェックリスト小計: チェック数 * step を四捨五入、maxを超えない（HTMLツールと同一式）
export function checklistScore(sub: ChecklistSub, checks: boolean[] | undefined): number {
  const n = (checks || []).filter(Boolean).length;
  return Math.min(Math.round(n * sub.step), sub.max);
}

export type SectionResult = {
  section: Section;
  score: number;
  effectiveMax: number; // 判定不能分を除いた満点
  naApplied: boolean;
  answeredAll: boolean;
};

export function scoreSection(section: Section, a: HumanAnswers): SectionResult {
  const naApplied = !!(section.na && a.naFlags[section.id]);
  const excluded = new Set(naApplied ? section.na!.targetSubIds : []);
  let score = 0;
  let effectiveMax = 0;
  let answeredAll = true;
  for (const sub of section.subs) {
    if (excluded.has(sub.id)) continue;
    if (sub.kind === "radio") {
      effectiveMax += Math.max(...sub.options.map((o) => o.pts));
      const sel = a.radios[sub.id];
      if (sel === undefined) answeredAll = false;
      else score += sub.options[sel].pts;
    } else {
      effectiveMax += sub.max;
      score += checklistScore(sub, a.checks[sub.id]);
    }
  }
  return { section, score, effectiveMax, naApplied, answeredAll };
}

export function scoreHuman(a: HumanAnswers) {
  const results = HUMAN_SECTIONS.map((s) => scoreSection(s, a));
  const part1 = results.filter((r) => r.section.part === 1);
  const part2 = results.filter((r) => r.section.part === 2);
  const sum = (rs: SectionResult[]) => rs.reduce((t, r) => t + r.score, 0);
  const sumMax = (rs: SectionResult[]) => rs.reduce((t, r) => t + r.effectiveMax, 0);
  return {
    results,
    part1Score: sum(part1),
    part1Max: sumMax(part1),
    part2Score: sum(part2),
    part2Max: sumMax(part2),
    total: sum(results),
    effectiveMax: sumMax(results),
    hasNa: results.some((r) => r.naApplied),
    complete: results.every((r) => r.answeredAll),
  };
}
