# ⚡ Plus Ultra RPG — Plataforma de RPG (Boku no Hero Academia)

Plataforma completa de RPG textual com autenticação, personagens, chat em tempo real,
inventário, missões, arena de batalha e muito mais — tudo conectado ao **Supabase**.

---

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [GitHub](https://github.com)
- Conta no [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) (gratuita, para hospedar)
- Node.js 18+ instalado na sua máquina (apenas se quiser rodar localmente)

---

## 🗄️ Passo 1 — Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Anote o **Project URL** e a **anon public key** (em *Project Settings → API*).
3. Vá em **SQL Editor** no painel do Supabase.
4. Abra o arquivo `supabase-schema.sql` (na raiz deste projeto), copie todo o conteúdo
   e cole no SQL Editor. Clique em **Run**.
   - Isso cria todas as tabelas (profiles, characters, items, quests, messages, etc),
     as políticas de segurança (RLS), o bucket de avatares e os triggers automáticos.
5. Vá em **Authentication → Providers** e confirme que **Email** está habilitado.
6. (Opcional, recomendado para produção) Em **Authentication → URL Configuration**,
   configure a *Site URL* com o domínio onde o site vai ficar publicado (ex:
   `https://seu-site.vercel.app`), e adicione esse mesmo domínio em *Redirect URLs*.
7. (Opcional) Em **Authentication → Email Templates**, você pode personalizar o
   e-mail de confirmação de cadastro.

> ⚠️ Por padrão o Supabase exige confirmação de e-mail antes do login funcionar.
> Se quiser testar mais rápido, vá em **Authentication → Providers → Email** e
> desative "Confirm email" temporariamente (não recomendado em produção).

---

## 💻 Passo 2 — Rodar localmente (opcional, mas recomendado para testar antes do deploy)

```bash
# 1. Instalar dependências
npm install

# 2. Criar o arquivo de variáveis de ambiente
cp .env.example .env

# 3. Editar o .env e colar sua URL e Anon Key do Supabase
#    VITE_SUPABASE_URL=https://xxxxx.supabase.co
#    VITE_SUPABASE_ANON_KEY=eyJxxxxx...

# 4. Rodar em modo desenvolvimento
npm run dev
```

Acesse `http://localhost:5173` — você deve ver a tela de login/cadastro.

---

## 🐙 Passo 3 — Subir para o GitHub

```bash
git init
git add .
git commit -m "Plus Ultra RPG — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/plus-ultra-rpg.git
git push -u origin main
```

> O arquivo `.gitignore` já está configurado para não subir `node_modules`,
> `dist` e o seu `.env` (que contém suas chaves privadas).

---

## 🚀 Passo 4 — Deploy (Vercel — recomendado)

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `plus-ultra-rpg` que você acabou de subir.
4. A Vercel detecta automaticamente que é um projeto Vite. Confirme:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → sua anon key do Supabase
6. Clique em **Deploy**. Em ~1 minuto seu site estará no ar em um domínio tipo
   `https://plus-ultra-rpg.vercel.app`.

### Alternativa — Netlify

1. Acesse [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
2. Conecte o GitHub e selecione o repositório.
3. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Em **Site settings → Environment variables**, adicione as mesmas duas
   variáveis (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
5. Clique em **Deploy site**.

### Importante após o deploy

Volte ao painel do Supabase em **Authentication → URL Configuration** e
atualize a *Site URL* e *Redirect URLs* com o domínio final do seu site
(ex: `https://plus-ultra-rpg.vercel.app`). Isso garante que os links de
confirmação de e-mail funcionem corretamente.

---

## 🎮 Como o sistema funciona

### Cadastro e login
- A primeira tela é sempre a de **Login/Cadastro**.
- No cadastro, o usuário define usuário, e-mail, senha, e já cria o
  personagem inicial (nome, codinome, cor do avatar).
- Após confirmar o e-mail, o usuário consegue logar.
- Assim que loga, o sistema marca o perfil como **online** e ele passa a
  aparecer na aba **Jogadores** e na lista de online do chat para todos os
  outros usuários conectados, em tempo real.

### Dados armazenados no Supabase
Tudo que cada usuário cria fica salvo no banco e vinculado à conta dele:
- **profiles** — usuário, e-mail, foto de perfil, status online
- **characters** — ficha completa do personagem (atributos, vitais, Quirk, técnicas)
- **items** — inventário pessoal
- **quests** — missões pessoais com objetivos
- **reputation** — estatísticas (civis salvos, vilões capturados, créditos...)
- **messages** — mensagens de chat por local (em tempo real via Supabase Realtime)
- **feed_posts / news / events** — feed da comunidade, visível a todos
- **ranking** — ranking de jogadores, editável por qualquer membro
- **locations** — locais de RP, criados pelos jogadores/mestre
- **fighters / battle_log** — arena de batalha compartilhada em tempo real

### Realtime
O chat, o feed e a arena de batalha usam **Supabase Realtime** — quando um
jogador envia uma mensagem ou registra uma ação de combate, todos os outros
jogadores conectados veem instantaneamente, sem precisar atualizar a página.

### Segurança (RLS)
Todas as tabelas têm **Row Level Security** habilitada:
- Qualquer usuário autenticado pode **ver** os dados de todos (perfis,
  personagens, mensagens, etc) — afinal é uma plataforma social de RPG.
- Mas cada usuário só pode **editar ou apagar** os próprios dados (seu
  personagem, seus itens, suas missões, seus posts). Ninguém consegue editar
  a ficha de outro jogador.

---

## 🛠️ Estrutura do projeto

```
plus-ultra-rpg/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── supabase-schema.sql       ← rode este SQL no Supabase
├── src/
│   ├── main.jsx
│   ├── App.jsx                ← roteamento (login vs. app)
│   ├── lib/
│   │   └── supabase.js        ← todas as funções de acesso ao banco
│   ├── hooks/
│   │   └── useAuth.jsx        ← contexto de autenticação
│   ├── components/
│   │   ├── Avatar.jsx
│   │   ├── Modal.jsx
│   │   └── Toast.jsx
│   ├── pages/
│   │   ├── AuthPage.jsx       ← tela de login/cadastro
│   │   ├── AppShell.jsx       ← layout principal (sidebar + topbar)
│   │   └── views/
│   │       ├── ChatView.jsx
│   │       ├── ArenaView.jsx
│   │       ├── ExploreView.jsx
│   │       ├── FichaView.jsx
│   │       ├── QuirkView.jsx
│   │       ├── InventoryView.jsx
│   │       ├── QuestsView.jsx
│   │       ├── RankingView.jsx
│   │       ├── FeedView.jsx
│   │       ├── PlayersView.jsx
│   │       ├── DiceView.jsx
│   │       └── SettingsView.jsx
│   └── styles/
│       └── global.css
```

---

## ❓ Problemas comuns

**"Faltam variáveis VITE_SUPABASE_URL..."**
→ Verifique se o arquivo `.env` existe e tem as duas variáveis preenchidas
(local), ou se você configurou as Environment Variables no painel da
Vercel/Netlify (produção).

**Cadastro funciona mas login dá "Email not confirmed"**
→ O Supabase exige confirmação de e-mail por padrão. Verifique a caixa de
entrada (e spam) do e-mail cadastrado, ou desative a confirmação em
Authentication → Providers → Email (apenas para testes).

**Mensagens não aparecem em tempo real**
→ Confira se rodou o SQL completo, incluindo a seção final
`alter publication supabase_realtime add table ...`. Isso habilita o Realtime
nas tabelas necessárias.

**Erro de permissão (RLS) ao salvar algo**
→ Confirme que o usuário está autenticado (logado) e que o SQL schema foi
executado por completo, sem erros.

---

Bom jogo, herói! ⚡✦
