# Projeto Painel de Moderação para WhatsApp com Bot Interativo

## Visão Geral do Projeto

Este projeto consiste num sistema de moderação para grupos do WhatsApp, composto por:

1.  **Backend (Node.js + Express + whatsapp-web.js):**
    * Conecta-se ao WhatsApp através da biblioteca `whatsapp-web.js`.
    * Monitoriza mensagens em grupos autorizados.
    * Deteta palavras proibidas e sensíveis.
    * Aplica advertências e outras ações de moderação automaticamente.
    * Responde a comandos específicos (ex: `!denuncia`).
    * Fornece uma API REST para o frontend gerir configurações, visualizar eventos e interagir com o bot.
    * Armazena dados (configurações, listas de palavras, eventos, advertências, etc.) em ficheiros JSON locais.

2.  **Frontend (React + Next.js + Tailwind CSS + Shadcn/UI):**
    * Um painel de administração web para moderadores.
    * Permite visualizar o status da conexão do WhatsApp e escanear QR Code.
    * Gerir listas de grupos autorizados para monitorização.
    * Gerir listas de palavras proibidas e sensíveis.
    * Configurar o comportamento do bot (limite de advertências, ação de reincidência).
    * Visualizar um histórico detalhado de eventos de moderação (mensagens filtradas, advertências, denúncias).
    * Gerar relatórios de atividade.
    * Gerir utilizadores banidos.
    * Rever e processar denúncias (manuais ou iniciadas por comando).
    * Interface com modo claro e escuro.

O objetivo é fornecer uma ferramenta para ajudar na moderação de comunidades em grupos do WhatsApp, automatizando algumas tarefas e centralizando o controlo e visualização de atividades.

## Funcionalidades Principais

* **Moderação Automática:**
    * Deteção de palavras proibidas com deleção de mensagem, aviso ao utilizador, PM ao infrator e notificação a admins.
    * Deteção de palavras sensíveis com registo para revisão.
    * Sistema de advertências com contagem e ações automáticas (alerta, sugestão de silenciar/expulsar) ao atingir o limite.
* **Interação via Comando no WhatsApp:**
    * Comando `!denuncia` para utilizadores iniciarem um processo de denúncia.
* **Painel de Controlo Web (Frontend):**
    * Dashboard com status do WhatsApp e QR Code.
    * Gestão de grupos a serem monitorizados (com listagem de grupos da conta do bot).
    * Gestão de palavras-chave (proibidas e sensíveis).
    * Configurações de moderação (limite de advertências, ação de reincidência).
    * Visualização de histórico de eventos detalhado com filtros.
    * Geração de relatórios de atividade.
    * Gestão de utilizadores banidos.
    * Secção para revisão de denúncias e mensagens marcadas.
    * Interface responsiva e com tema claro/escuro.
* **Persistência de Dados:**
    * Configurações, listas, eventos e advertências são guardados em ficheiros JSON no backend.
* **API REST:**
    * Comunicação entre o frontend e o backend para todas as operações de gestão e visualização.

## Estrutura do Projeto (Sugerida)

/painel-moderador/├── /painel-frontend/        # Projeto Next.js (Frontend)│   ├── /app/│   ├── /components/│   │   └── ui/              # Componentes Shadcn/UI│   │   └── GraficoOfensasCliente.tsx # Exemplo de componente cliente│   ├── /lib/│   │   └── utils.ts│   ├── next.config.mjs│   ├── package.json│   ├── postcss.config.js│   ├── tailwind.config.ts│   └── tsconfig.json│└── /painel-backend/         # Projeto Node.js/Express (Backend)├── /dados/              # Ficheiros JSON para persistência│   ├── whatsapp_auth/   # Pasta para sessão do WhatsApp│   ├── advertencias.json│   ├── configuracoes.json│   ├── eventos_salvos.json│   ├── grupos_autorizados.json│   ├── palavras_proibidas.json│   ├── palavras_sensiveis.json│   └── usuarios_banidos.json├── index.js             # Ficheiro principal do servidor backend├── package.json└── .env                 # Ficheiro para variáveis de ambiente
## Tecnologias Utilizadas

**Backend:**

* Node.js
* Express.js
* `whatsapp-web.js` (para interação com o WhatsApp)
* `qrcode` (para gerar QR Code para o terminal e para o frontend)
* `cors`
* `dotenv`
* `uuid` (para gerar IDs únicos)
* Ficheiros JSON para persistência de dados

**Frontend:**

* React
* Next.js (App Router)
* TypeScript
* Tailwind CSS
* Shadcn/UI (para componentes de UI)
* Lucide React (para ícones)
* Recharts (para gráficos)
* Axios (para chamadas API)
* Framer Motion (para animações)
* `next-themes` (para modo claro/escuro)

## Configuração e Instalação

### Pré-requisitos

* Node.js (v18+ recomendado para `whatsapp-web.js`)
* NPM ou Yarn
* Um número de WhatsApp dedicado para o bot (não recomendado usar o seu número pessoal principal).
* Google Chrome instalado (para Puppeteer, usado pelo `whatsapp-web.js`, a menos que configurado de outra forma).

### Backend (`/painel-backend/`)

1.  **Navegue até à pasta do backend:**
    ```bash
    cd painel-backend
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```
3.  **Crie o ficheiro de ambiente:**
    * Crie um ficheiro chamado `.env` na raiz da pasta `painel-backend`.
    * Adicione as seguintes variáveis (ajuste conforme necessário):
        ```env
        PORT=3001
        PAINEL_USER=admin
        PAINEL_PASS=admin123
        ```
4.  **Crie a pasta de dados:**
    * Dentro de `painel-backend`, crie uma pasta chamada `dados`. O script tentará criá-la se não existir, mas é bom garantir.
    * A subpasta `whatsapp_auth` será criada automaticamente pela `whatsapp-web.js` para guardar a sessão.

### Frontend (`/painel-frontend/`)

1.  **Navegue até à pasta do frontend:**
    ```bash
    cd painel-frontend
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```
3.  **Configure a URL da API (se necessário):**
    * No ficheiro `app/page.tsx` (ou onde `API_BASE_URL` estiver definido), certifique-se de que a constante `API_BASE_URL` aponta para o endereço do seu backend (por defeito `http://localhost:3001`).

## Execução do Projeto

### 1. Iniciar o Backend

1.  Navegue até à pasta `/painel-backend/`.
2.  Execute o servidor:
    ```bash
    node index.js
    ```
3.  Na primeira vez (ou se a sessão expirar), um QR Code será exibido no terminal. Escaneie este QR Code com a aplicação WhatsApp no telemóvel que será usado para o bot.
4.  Aguarde a mensagem "✅ WhatsApp conectado com sucesso!" no terminal.
5.  O servidor backend estará a correr em `http://localhost:3001` (ou na porta definida no `.env`).

### 2. Iniciar o Frontend

1.  Navegue até à pasta `/painel-frontend/`.
2.  Execute o servidor de desenvolvimento Next.js:
    ```bash
    npm run dev
    # ou
    yarn dev
    ```
3.  Abra o seu navegador e aceda a `http://localhost:3000` (ou a porta indicada no terminal).
4.  Deverá ver a interface do Painel de Moderação.

## Funcionalidades do Bot WhatsApp (no Grupo)

* **Deteção de Palavras Proibidas:**
    * Se uma mensagem contiver uma palavra da lista de "Palavras Proibidas":
        * A mensagem original é apagada (se o bot for admin).
        * O bot envia uma mensagem no grupo: `🚫 @[utilizador], a sua mensagem continha conteúdo inadequado e foi removida. Uma advertência foi registada.`
        * O bot tenta enviar uma PM ao utilizador: `🔔 ADVERTÊNCIA 🔔 ... (detalhes da advertência) ...`
        * O bot notifica os admins do grupo: `🔔 Alerta de Moderação para Admins 🔔 ... O utilizador @[utilizador] recebeu uma advertência ...`
        * Uma advertência é contabilizada para o utilizador.
* **Deteção de Palavras Sensíveis:**
    * Se uma mensagem contiver uma palavra da lista de "Palavras Sensíveis":
        * Um evento é registado no sistema para revisão pelo moderador no painel. Nenhuma ação visível ocorre no grupo.
* **Comando `!denuncia`:**
    * Qualquer membro do grupo pode enviar `!denuncia`.
    * O bot responde no grupo com instruções sobre como fornecer os detalhes da denúncia.
    * Um evento `denuncia_iniciada_comando` é registado.
* **Ações de Reincidência (Automáticas ao atingir limite de advertências):**
    * **Alerta (padrão):** Notifica os admins do grupo sobre o limite atingido.
    * **Sugerir Silenciar:** Notifica os admins sugerindo que silenciem o utilizador manualmente.
    * **Sugerir Expulsão:** Se o bot for admin, tenta expulsar o utilizador. Caso contrário, notifica os admins para que o façam manualmente.

## Funcionalidades do Painel de Moderação (Frontend)

* **Dashboard:**
    * Visualizar o status da conexão do WhatsApp.
    * Ver e escanear o QR Code se a conexão estiver pendente.
    * Gráfico de resumo de ofensas.
* **Configurações:**
    * Definir o limite de advertências antes de uma ação de reincidência.
    * Escolher a ação de reincidência (Alerta, Silenciar, Expulsar).
* **Moderação:**
    * **Grupos Permitidos:**
        * Listar os grupos da conta WhatsApp do bot (indicando se o bot é admin).
        * Adicionar grupos (selecionando da lista ou inserindo ID manualmente) para monitorização.
        * Remover grupos da monitorização.
    * **Palavras Proibidas:** Adicionar e remover palavras que acionam advertências imediatas.
    * **Palavras Sensíveis:** Adicionar e remover palavras que são apenas registadas para revisão.
* **Histórico:**
    * Visualizar uma lista cronológica de todos os eventos registados pelo bot (mensagens proibidas, sensíveis, advertências aplicadas, denúncias, etc.).
    * Filtrar eventos por utilizador, grupo ou conteúdo da mensagem.
    * Opção para buscar o histórico de advertências de um utilizador específico.
* **Relatórios:**
    * Gerar um relatório semanal de infrações (palavras proibidas/sensíveis detetadas).
* **Banidos:**
    * Adicionar utilizadores (por ID) à lista de banidos (o backend tentará removê-los de grupos monitorizados se o bot for admin e um grupo for especificado).
    * Remover utilizadores da lista de banidos.
* **Registro (Revisão de Mensagens):**
    * Visualizar eventos que requerem atenção do moderador (ex: denúncias manuais, mensagens com palavras sensíveis marcadas como `statusRevisao: 'pendente'`).
    * **Aprovar Denúncia:** Aplicar uma advertência ao utilizador denunciado.
    * **Rejeitar Denúncia:** Marcar a denúncia como resolvida sem ação.
    * Opção para simular uma denúncia manualmente através do painel.

## Notas Importantes e Considerações

* **Segurança da Conta WhatsApp:** O uso de bibliotecas como `whatsapp-web.js` não é oficialmente suportado pelo WhatsApp e acarreta o risco de bloqueio da conta. Utilize um número de telefone dedicado e não o seu principal. Evite spam ou comportamento abusivo através do bot.
* **Permissões do Bot:** Para que o bot possa apagar mensagens ou remover/adicionar participantes, ele precisa de ter permissões de administrador no grupo do WhatsApp.
* **Estabilidade:** A biblioteca `whatsapp-web.js` depende da interface do WhatsApp Web, que pode mudar e, ocasionalmente, quebrar a funcionalidade da biblioteca até que seja atualizada.
* **Persistência de Dados:** Os dados são guardados em ficheiros JSON. Para aplicações maiores ou mais críticas, considere migrar para um sistema de banco de dados mais robusto (ex: SQLite, PostgreSQL, MongoDB).
* **Autenticação do Painel:** A autenticação implementada é básica (utilizador/senha no `.env`). Para produção, implemente um sistema de autenticação mais seguro (ex: JWT com hashing de senhas).
* **Mensagens Privadas (PMs):** O envio de PMs pelo bot pode falhar se o utilizador tiver bloqueado o bot ou tiver configurações de privacidade restritivas.
* **Obtenção de IDs:** Para adicionar grupos ou banir utilizadores manualmente, precisará dos seus IDs do WhatsApp (ex: `xxxxxxxxxxx@c.us` para utilizadores, `xxxxxxxxxxx-yyyyyyyyyyyy@g.us` para grupos). A funcionalidade de listar grupos do bot ajuda a obter os IDs dos grupos.

## Futuras Melhorias (Sugestões)

* Implementar um sistema de recolha de detalhes para o comando `!denuncia` (ex: o bot fazer perguntas sequenciais).
* Melhorar a interface de revisão de denúncias com mais contexto.
* Adicionar a capacidade de editar mensagens de resposta do bot através do painel.
* Integrar um sistema de logging mais avançado para o backend.
* Implementar autenticação JWT robusta para a API e o painel.
* Permitir que moderadores executem ações diretas (silenciar, expulsar) a partir do painel (com as devidas verificações de permissão do bot no grupo).
* Internacionalização (i18n) para o painel.

MIT License

Copyright (c) 2024 @Dguloni

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
