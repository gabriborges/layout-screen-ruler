# Contribuindo

Obrigado por querer ajudar! 🎉 _(English below.)_

## Reportar um problema ou sugerir algo

Abra uma [issue](https://github.com/gabriborges/layout-screen-ruler/issues/new/choose)
dizendo o sistema operacional (e a versão), a versão do app e, se for um problema, os
passos para reproduzir. Capturas de tela ajudam muito.

## Enviar uma alteração

1. Faça um fork e crie um branch: `git checkout -b minha-melhoria`
2. Instale e rode: `npm install` e `npm start`
3. Teste a mudança — de preferência em mais de um sistema, se ela mexer em janelas,
   bandeja ou atalhos.
4. Se a interface mudou, recrie as imagens da documentação: `npm run assets -- --docs`
5. Abra um Pull Request explicando o que mudou e por quê.

### Orientações

- Textos da interface ficam em `src/shared/i18n.js` — adicione sempre **pt** e **en**.
- Valores padrão e limites ficam em `src/shared/config.js`.
- As janelas usam `contextIsolation` e `sandbox`; toda comunicação com o processo
  principal passa pelos arquivos de `src/preload/`.
- Mantenha o app leve: sem dependências de produção, só Electron.

---

## English

Thanks for helping! Open an
[issue](https://github.com/gabriborges/layout-screen-ruler/issues/new/choose) with your OS,
app version and steps to reproduce. For code changes: fork, `npm install`, `npm start`,
test (ideally on more than one OS if you touch windows, tray or shortcuts), run
`npm run assets -- --docs` if the UI changed, and open a Pull Request. UI strings live in
`src/shared/i18n.js` — please add both **pt** and **en**.
