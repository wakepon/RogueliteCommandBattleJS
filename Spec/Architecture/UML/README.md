# UML図

SystemDesign.mdの内容を図示したファイル群です。

## 形式

- **PlantUML** (.puml): 本ディレクトリに配置
- **Mermaid** (.md): [Mermaid/](./Mermaid/) サブディレクトリに配置

GitHubで直接プレビューしたい場合はMermaid版をご利用ください。

## 図の一覧（PlantUML）

| ファイル | 説明 |
|---------|------|
| [InterfaceHierarchy.puml](./InterfaceHierarchy.puml) | インターフェース継承関係図。IItem、IPurchasable等の基本インターフェースからWeaponData、SpellData等のアイテム型への継承を示す |
| [StateStructure.puml](./StateStructure.puml) | 状態管理構造図。GameState、RunState、ExplorerState、BattleState等のデータ構造と関係を示す |
| [ScreenFlow.puml](./ScreenFlow.puml) | 画面遷移フロー図。title→battle→store→eventの遷移を状態遷移図で示す |
| [FolderStructure.puml](./FolderStructure.puml) | フォルダ構造とレイヤー図。Lib/、Hooks/、Components/、Data/の構成と依存関係を示す |
| [SaveLoadFlow.puml](./SaveLoadFlow.puml) | セーブ/ロードフロー図。戦闘終了後のセーブタイミングと中断時の挙動を示す |
| [DevelopmentPhases.puml](./DevelopmentPhases.puml) | 開発フェーズ図。Phase 1〜4の実装対象と依存関係を示す |

## 表示方法

### VS Code
- PlantUML拡張機能をインストール
- `.puml`ファイルを開いてプレビュー表示（Alt+D）

### オンラインサービス
- [PlantUML Web Server](http://www.plantuml.com/plantuml/uml/)
- ファイル内容を貼り付けて表示

### コマンドライン
```bash
# PlantUMLがインストールされている場合
plantuml *.puml

# PNG出力
plantuml -tpng *.puml

# SVG出力
plantuml -tsvg *.puml
```
