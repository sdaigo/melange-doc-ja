---
title: 'Getting Started'
---

# Getting Started

Melange ならすぐに使い始めることができます！

---

## パッケージマネージャーのインストール

Melange を使用するには、OCaml と互換性のあるパッケージマネージャをインストールする必要があります。どれを使えばいいかわからない場合は、OCaml 用のソースベースのパッケージマネージャーである opam をお勧めしますが、他にも利用可能なものがあります。

opam を様々な OS にインストールする方法は、opam のインストールページにあります。

### テンプレート

Melange を使い始める最も簡単な方法は、[melange-opam-template](https://github.com/melange-re/melange-opam-template)を使うことです。この[リンク](https://github.com/melange-re/melange-opam-template/generate)からテンプレートをクローンし、readme ファイルの指示に従ってローカルの opam スイッチを設定し、プロジェクトをビルドするために必要な依存関係をダウンロードしてください。

```bash
make init

# In separate terminals:
make watch
make serve
```

### エディターの統合

Melange の目標の 1 つは、OCaml との互換性を維持することです。この互換性の主な利点の 1 つは、Melange プロジェクトで作業する開発者が、OCaml と同じエディタツールを使用できることです。

OCaml の開発者ツールは、長年にわたって構築、テスト、改良されており、多くのエディタでプラグインが利用できます。最も活発にメンテナンスされているプラグインは、Visual Studio Code、Emacs、Vim です。

Visual Studio Code の場合は、Visual Studio Marketplace から OCaml Platform Visual Studio Code エクステンションをインストールする。OCaml ソース・ファイルを初めてロードするとき、使用するツール・チェーンを選択するプロンプトが表示されることがある。5.1.1 など、使用する OCaml のバージョンをリストから選択してください。設定に関する詳しい説明は、拡張機能のリポジトリにあります。

Emacs と Vim の場合、設定は場合によって異なり、いくつかのオプションがあります。OCamlverse ドキュメンテーションサイトのエディタセットアップページをご覧ください。

## Alternative package managers (experimental)

Melange can also be used with other package managers. The following instructions apply to [Nix](https://melange.re/v2.2.0/getting-started/#nix) and [esy](https://melange.re/v2.2.0/getting-started/#esy).

### [Nix](https://nixos.org/)

Melange provides an overlay that can be:

- referenced from a [Nix flake](https://nixos.wiki/wiki/Flakes)
- overlayed onto a `nixpkgs` package set

Make sure [Nix](https://nixos.org/download.html) is installed. The following `flake.nix` illustrates how to set up a Melange development environment.

```nix
{
  description = "Melange starter";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:nixos/nixpkgs";

    # Depend on the Melange flake, which provides the overlay
    melange.url = "github:melange-re/melange";
  };

  outputs = { self, nixpkgs, flake-utils, melange }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system}.appendOverlays [
          # Set the OCaml set of packages to the 5.1 release line
          (self: super: { ocamlPackages = super.ocaml-ng.ocamlPackages_5_1; })
          # Apply the Melange overlay
          melange.overlays.default
        ];
        inherit (pkgs) ocamlPackages;
      in

      {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with ocamlPackages; [
            ocaml
            dune_3
            findlib
            ocaml-lsp
            ocamlPackages.melange
          ];
          buildInputs = [ ocamlPackages.melange ];
        };
      });
}
```

To enter a Melange development shell, run `nix develop -c $SHELL`.

### [esy](https://esy.sh/)

First, make sure `esy` is [installed](https://esy.sh/docs/en/getting-started.html#install-esy). `npm i -g esy` does the trick in most setups.

The following is an example `esy.json` that can help start a Melange project. A [project template for esy](https://github.com/melange-re/melange-esy-template) is also available if you prefer to [start from a template](https://github.com/melange-re/melange-esy-template/generate).

```json
{
  "name": "melange-project",
  "dependencies": {
    "ocaml": "5.1.x",
    "@opam/dune": ">= 3.8.0",
    "@opam/melange": "*"
  },
  "devDependencies": {
    "@opam/ocaml-lsp-server": "*"
  },
  "esy": {
    "build": ["dune build @melange"]
  }
}
```

Run:

1. `esy install` to build and make all dependencies available
2. `esy shell` to enter a Melange development environment
