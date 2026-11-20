# Como publicar no GitHub

Guia para quem mantém o projeto: colocar o código no GitHub e lançar versões com os
instaladores para Windows, macOS e Linux.

## 1. Primeira publicação

1. Crie um repositório **público** vazio no GitHub chamado `layout-screen-ruler`
   (sem README, sem licença — o projeto já tem os dois).
2. Na pasta do projeto, rode:

   ```bash
   git init
   git add .
   git commit -m "Layout Screen Ruler 1.0.0"
   git branch -M main
   git remote add origin https://github.com/gabriborges/layout-screen-ruler.git
   git push -u origin main
   ```

3. No GitHub, abra **Settings › Actions › General** e confirme que as Actions estão
   permitidas e que, em **Workflow permissions**, está marcado
   **Read and write permissions** (necessário para criar o Release).

> Se o seu usuário ou o nome do repositório forem outros, troque
> `gabriborges/layout-screen-ruler` em `package.json`, `README.md`, `README.en.md`,
> `CONTRIBUTING.md` e neste arquivo.

## 2. Lançar uma versão

1. Atualize o número da versão em `package.json` (ex.: `"version": "1.0.0"`) e anote as
   mudanças em `CHANGELOG.md`.
2. Faça o commit e crie a tag **com o mesmo número**, começando com `v`:

   ```bash
   git commit -am "Versão 1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. Acompanhe na aba **Actions** o workflow **Build & Release**. Em ~10 minutos ele:
   - compila em máquinas Windows, macOS e Linux do próprio GitHub;
   - cria o Release `v1.0.0` com os 6 instaladores e um `SHA256SUMS.txt`.

Pronto: os botões de download do README passam a apontar para essa versão
automaticamente (eles usam o endereço `/releases/latest/download/...`).

### Testar a compilação sem lançar

Em **Actions › Build & Release › Run workflow**, rode manualmente. Os instaladores ficam
disponíveis como _artifacts_ da execução, sem criar Release.

## 3. Deixar a página do repositório caprichada

- **Imagem de prévia** (aparece quando o link é compartilhado): em **Settings ›
  General › Social preview**, envie `docs/images/pt/social-preview.png`
  (ou a versão `en`).
- **Descrição e tópicos**: na página inicial do repositório, clique na engrenagem de
  **About** e adicione uma descrição e tópicos como `screen-ruler`, `grid`, `overlay`,
  `layout`, `pixel`, `design-tools`, `electron`.
- Marque **Releases** em **About** para mostrar a última versão na lateral.

## 4. Atualizar as imagens da documentação

Mudou algo na interface? Recrie todas as imagens (pt e en) a partir do app real:

```bash
npm run assets -- --docs
```

## Sobre assinatura de código

Os instaladores **não são assinados** com certificados pagos (Apple Developer ID custa
US$ 99/ano; certificados de Windows custam mais). Por isso:

- **Windows** mostra o aviso do SmartScreen na primeira execução;
- **macOS** exige liberar em **Privacidade e Segurança** (o app usa assinatura _ad-hoc_,
  necessária para rodar em Macs com Apple Silicon).

O README explica ao usuário como passar por esses avisos. Se um dia quiser assinar, o
[electron-builder](https://www.electron.build/code-signing) lê os certificados das
variáveis `CSC_LINK`/`CSC_KEY_PASSWORD` (e, no Mac, `APPLE_ID` etc. para notarização) —
basta adicioná-las como _secrets_ do repositório e remover `identity: '-'` de
`electron-builder.yml`.
