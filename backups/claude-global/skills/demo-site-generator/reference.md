# demo-site-generator 業種別リファレンス

## 利用可能テンプレート

| --type 値 | テンプレートパス | ステータス |
|-----------|----------------|-----------|
| `beauty-salon` | `demos/beauty-salon/index.html` | 本番運用中 |

## beauty-salon テンプレート

**サービス項目デフォルト値:**
- service1: カット
- service2: カラー
- service3: パーマ
- service4: トリートメント

**対応している変数（全業種共通）:**
```
{{店名}} {{キャッチコピー}} {{電話番号}} {{住所}} {{営業時間}} {{定休日}}
{{サービス1}} {{サービス2}} {{サービス3}} {{サービス4}}
{{メールアドレス}} {{Google_Maps_Embed_URL}} {{Google_Maps_URL}}
{{Instagram_URL}} {{X_URL}} {{TikTok_URL}}
{{レビュー1_名前}} {{レビュー1_評価}} {{レビュー1_テキスト}}
{{レビュー2_名前}} {{レビュー2_評価}} {{レビュー2_テキスト}}
{{レビュー3_名前}} {{レビュー3_評価}} {{レビュー3_テキスト}}
{{FAQ1_Q}} {{FAQ1_A}} {{FAQ2_Q}} {{FAQ2_A}} {{FAQ3_Q}} {{FAQ3_A}}
```

**空変数の扱い:**
- レビュー・FAQセクション：全変数が空の場合 `display:none` で非表示
- SNSアイコン：URLが空でも表示（リンクなし状態）
- Googleマップ：embed URLが空の場合セクション表示なし

---

## 新業種テンプレート追加手順

1. `docs/frontend-design-rule.md` と `/mnt/skills/public/frontend-design/SKILL.md` を読む（CLAUDE.md参照）
2. `demos/$新業種名/index.html` を作成（`{{変数名}}` 形式のプレースホルダーを使う）
3. 本ファイル（reference.md）に業種行を追加、サービスデフォルト値と備考を記載
4. `create-demo.sh` の `--type` に新業種名を渡せば動作する（スクリプト修正不要）

---

## デプロイ先

- GitHub: `https://github.com/indiandeathrock-boop/local-biz-demos`
- Cloudflare Pages: `https://local-biz-demos.indiandeathrock.workers.dev/demos/clients/$slug/`
- 反映時間: GitHub push後 約1分
