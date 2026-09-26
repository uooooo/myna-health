# Prize Core (ETHGlobal Tokyo 2026)

医療・ヘルスケアの最終アイデアが決まる前に作った、ENSv2 と World IDKit の接続基盤です。最終製品ではなく、シナリオを差し替えるための技術検証です。既存の医療アプリのコードは使用していません。実患者情報、資格情報、診療内容は扱いません。

## 現在動く部分

- ENS: Sepolia の Universal Resolver を通した名前・アドレス・text record の読み取り。`getRecordId()` が使える Permissioned Resolver なら ENSv2 の record ID を表示します。
- ENS: Permissioned Resolver の `grantSetterRoles` / `revokeRoles` を呼ぶ CLI。名前から現行 resolver を毎回取得し、指定した text key のロールだけを委任・取消します。書き込み前に `simulateContract` します。
- World: IDKit 4 の Proof of Human ウィジェット、サーバー側 RP 署名、World v4 検証 API、action と nonce の照合、nullifier の再利用防止。
- Action: 操作・ENS 名・オフチェーン依頼のハッシュ・期限を World の action に結び付けます。拒否、期限切れ、未検証時には実行できません。承認済み操作の「実行」はローカルの状態変更だけです。
- `DEMO_MODE=true` のプレビューは proof を作らず、承認状態も変えません。

## 起動

Bun 1.4 以降を使用。

```bash
cd prize-core
bun install --frozen-lockfile
cp .env.example .env
bun run build
bun run test
bun run dev:api
```

`http://localhost:8787` にビルド済み画面と API が出ます。画面の変更を即時反映する場合は別ターミナルで `bun run dev:web` を起動し、`http://localhost:5173` を開きます。

### ENSv2

```bash
bun run ens:inspect your-v2-name.eth description
```

実際に委任する場合は `.env` に `ENS_WRITE_PRIVATE_KEY` と必要なら `SEPOLIA_RPC_URL` を設定し、**自分が権限を持つ ENSv2 名**で実行します。トランザクションと Sepolia ETH が必要です。

```bash
bun run ens:grant-text your-v2-name.eth care.status 0xDelegateAddress
bun run ens:revoke-text your-v2-name.eth care.status 0xDelegateAddress
```

`grantSetterRoles` は resolver 全体で指定 text key に効きます。同じ resolver 上の全ての名前に及ぶので、特定の名前だけを委任したい場合は名前ごとに resolver を分ける必要があります。コマンドは実際のオンチェーン書き込みです。

### World IDKit

World Developer Portal の `app_id`, `rp_id`, `signing_key` を `.env` に設定します。`WORLD_ENVIRONMENT=staging` なら staging simulator で確認できます。署名キーはサーバーだけに置いてください。World proof を取得できない環境では承認ボタンは無効です。

## アイデア決定後の接続点

1. `operation` を最終製品の具体的な行動にする。`payloadDigest` はオフチェーンの依頼内容をハッシュ化したものにする。
2. `execute` のローカル状態変更を、**承認された値をサーバーが再検証してから**具体的なコア操作に置き換える。
3. ENSv2 の役割・サブネーム・レコードを製品の中心に組み込み、所有名で実際に Sepolia 上の書き込みを見せる。
4. World IDKit 賞では「なぜ Proof of Human が最小限の資格なのか」を最終シナリオで説明し、成功と拒否を動画に入れる。World ID for Agents 賞を選ぶなら、イベント用の公式 dev 環境との別統合が必要です。
5. ライブデモ URL、公開 GitHub、2–4 分の製品動画を用意する。現在の画面は検証 UI であり、提出用の最終 UI ではありません。

## 確認済み・未確認

`bun run test` は action の差し替え、期限、再利用、拒否、World 環境不一致、ENS 委任 calldata を検証します。Sepolia の公開 ENS 名の読み取りは実ネットワークで確認しました。World 実 proof の往復、ENSv2 所有名への書き込み、ライブデプロイは認証情報と名義が未設定のため未確認です。現状だけで賞の応募条件を満たしたとは扱いません。

## 一次資料

- [ETHGlobal Tokyo 2026 prizes](https://ethglobal.com/events/tokyo2026/prizes)
- [ENSv2 Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/)
- [ENSv2 app integration](https://docs.ens.domains/ensv2/tutorial-app-developers/)
- [World IDKit integration](https://docs.world.org/world-id/idkit/integrate)
