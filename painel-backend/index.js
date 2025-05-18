import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import whatsapp from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = whatsapp;
import qrcodeLibrary from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Configuração de Autenticação (Simples) ---
const PAINEL_USER = process.env.PAINEL_USER || 'admin';
const PAINEL_PASS = process.env.PAINEL_PASS || '1234';

// --- Caminhos e Funções para Gerenciamento de Dados ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'dados');

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Diretório de dados criado em: ${DATA_DIR}`);
  }
};
ensureDataDir();

const DEFAULT_CONFIG = { limite: 3, acao: 'alerta' };

const readData = (fileName) => {
  const filePath = path.join(DATA_DIR, `${fileName}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`Arquivo ${fileName}.json não encontrado. Criando com valor padrão.`);
    let defaultData = {};
    if (fileName === 'configuracoes') defaultData = DEFAULT_CONFIG;
    else if (['grupos_autorizados', 'palavras_proibidas', 'palavras_sensiveis', 'usuarios_banidos', 'eventos_salvos', 'advertencias', 'relatorios_salvos'].includes(fileName)) defaultData = [];
    writeData(fileName, defaultData);
    return defaultData;
  }
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Erro ao ler o arquivo ${fileName}.json:`, error);
    if (fileName === 'configuracoes') return DEFAULT_CONFIG;
    if (['grupos_autorizados', 'palavras_proibidas', 'palavras_sensiveis', 'usuarios_banidos', 'eventos_salvos', 'advertencias', 'relatorios_salvos'].includes(fileName)) return [];
    return {};
  }
};

const writeData = (fileName, data) => {
  const filePath = path.join(DATA_DIR, `${fileName}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Erro ao escrever no arquivo ${fileName}.json:`, error);
  }
};

// --- Inicialização dos Dados em Memória ---
let eventosRecentes = [];
let qrCodeAtual = '';
let whatsappStatus = 'Desconectado';
let clientReady = false;

let palavrasProibidas = [];
let palavrasSensiveis = [];
let configuracoes = {};
let advertencias = [];
let usuariosBanidos = [];
let gruposAutorizados = [];

const loadInitialData = () => {
    palavrasProibidas = readData('palavras_proibidas');
    palavrasSensiveis = readData('palavras_sensiveis');
    configuracoes = readData('configuracoes');
    advertencias = readData('advertencias');
    usuariosBanidos = readData('usuarios_banidos');
    gruposAutorizados = readData('grupos_autorizados');
    eventosRecentes = readData('eventos_salvos');
    console.log('Dados iniciais carregados/recarregados do disco.');
};
loadInitialData();


// --- Configuração do Cliente WhatsApp ---
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(DATA_DIR, 'whatsapp_auth') }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'],
  }
});

client.on('qr', async (qr) => {
  try {
    qrCodeAtual = await qrcodeLibrary.toDataURL(qr);
    whatsappStatus = 'Aguardando conexão - Escaneie o QR Code';
    console.log('🟡 QR Code recebido, escaneie para conectar ao WhatsApp.');
  } catch (e) {
    console.error("Erro ao gerar QR Code Data URL:", e);
  }
});

client.on('ready', () => {
  whatsappStatus = 'Conectado';
  clientReady = true;
  console.log('✅ WhatsApp conectado com sucesso!');
  loadInitialData(); // Carrega os dados após o cliente estar pronto
});

client.on('disconnected', (reason) => {
  whatsappStatus = `Desconectado: ${reason}`;
  clientReady = false;
  qrCodeAtual = '';
  console.log('🔴 WhatsApp foi desconectado!', reason);
});

client.on('auth_failure', msg => {
    whatsappStatus = `Falha na autenticação: ${msg}`;
    clientReady = false;
    qrCodeAtual = '';
    console.error('Falha na autenticação do WhatsApp:', msg);
});

client.on('loading_screen', (percent, message) => {
    console.log('Carregando WhatsApp:', percent, message);
    whatsappStatus = `Carregando: ${message} (${percent}%)`;
});

// Função para adicionar evento e persistir
const adicionarEvento = (tipo, dadosMsg) => {
  const novoEvento = {
    id: uuidv4(),
    tipo: tipo,
    dados: {
      timestamp: new Date().toISOString(),
      ...dadosMsg
    }
  };
  let eventosAtuais = readData('eventos_salvos');
  eventosAtuais.unshift(novoEvento);
  if (eventosAtuais.length > 200) {
    eventosAtuais.pop();
  }
  writeData('eventos_salvos', eventosAtuais);
  eventosRecentes = eventosAtuais;
};

// Listener de Mensagens do WhatsApp
client.on('message', async (msg) => {
  if (!clientReady) {
    console.warn("[MSG IGNORADA] Cliente WhatsApp não está pronto.");
    return;
  }
  // As listas (palavrasProibidas, etc.) são carregadas no início e atualizadas via API.
  // Não é ideal recarregar do disco a cada mensagem.

  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
        // console.log("[MSG IGNORADA] Não é uma mensagem de grupo.");
        return;
    }

    const groupIdSerialized = chat.id._serialized;
    // Verifica se o grupo está na lista de grupos autorizados
    // É importante que `gruposAutorizados` esteja atualizado
    if (!gruposAutorizados.includes(groupIdSerialized) && !gruposAutorizados.includes(chat.name)) {
        // console.log(`[MSG IGNORADA] Grupo não autorizado: ${chat.name} (${groupIdSerialized})`);
        return;
    }

    const contact = await msg.getContact();
    // Para mensagens de grupo, msg.author é o ID do remetente. msg.from é o ID do grupo.
    const senderId = msg.author;
    if (!senderId) {
        console.warn(`[MSG IGNORADA] Não foi possível identificar o remetente (msg.author undefined) no grupo ${chat.name}. msg.from: ${msg.from}`);
        return;
    }
    const senderName = contact.pushname || contact.name || senderId.split('@')[0];
    const messageBody = msg.body;
    const messageBodyLower = messageBody.toLowerCase();
    let mensagemDeletadaPeloBot = false;

    console.log(`[MSG RECEBIDA] Grupo: "${chat.name}" (${groupIdSerialized}), De: "${senderName}" (${senderId}), Msg: "${messageBody}"`);

    // Comando !denuncia
    if (messageBodyLower.trim() === '!denuncia') {
        console.log(`[COMANDO] !denuncia recebido de ${senderName} no grupo ${chat.name}`);
        const denuncianteContact = contact; // Já temos o contato
        const textoDenuncia = `📝 @${senderId.split('@')[0]} iniciou um processo de denúncia.\n` +
            `Para prosseguir, por favor, forneça detalhes respondendo a esta mensagem ou use o painel de moderação.\n\n` +
            `Detalhes necessários:\n` +
            `1. **Quem você quer denunciar?** (Nome ou @menção do utilizador)\n` +
            `2. **Qual o motivo da denúncia?**\n` +
            `3. **Qual(is) mensagem(ns) específica(s) da infração?** (Copie e cole, se possível)\n` +
            `4. **Quando ocorreu?** (Data e hora aproximada da infração)`;
        try {
            console.log(`[AÇÃO] A tentar enviar instruções de denúncia para o grupo ${chat.name}`);
            await chat.sendMessage(textoDenuncia, { mentions: [denuncianteContact] });
            console.log(`[SUCESSO] Instruções de denúncia enviadas para ${chat.name}`);
        } catch (e) {
            console.error(`[ERRO] Ao enviar instruções de denúncia para ${chat.name}:`, e);
        }
        adicionarEvento('denuncia_iniciada_comando', {
            grupo: chat.name, grupoId: groupIdSerialized,
            denunciante: senderName, denuncianteId: senderId,
            mensagemComando: messageBody,
        });
        return;
    }

    // Verifica palavras proibidas
    for (const palavra of palavrasProibidas) {
      if (messageBodyLower.includes(palavra.toLowerCase())) {
        console.log(`[PALAVRA PROIBIDA] "${palavra}" detectada de ${senderName} no grupo ${chat.name}`);
        
        try {
            console.log(`[AÇÃO] A tentar apagar mensagem de ${senderName}`);
            await msg.delete(true);
            mensagemDeletadaPeloBot = true;
            console.log(`[SUCESSO] Mensagem de ${senderName} apagada.`);
        } catch (deleteError) {
            console.error(`[ERRO] Ao apagar mensagem de ${senderName}:`, deleteError.message);
            adicionarEvento('falha_deletar_mensagem_proibida', { grupo: chat.name, usuario: senderName, erro: deleteError.message });
        }

        const contatoAdvertido = contact;
        const msgAdvertenciaGrupo = `🚫 @${senderId.split('@')[0]}, a sua mensagem continha conteúdo inadequado${mensagemDeletadaPeloBot ? ' e foi removida' : ''}. Uma advertência foi registada.`;
        try {
            console.log(`[AÇÃO] A tentar enviar advertência no grupo ${chat.name} para ${senderName}`);
            await chat.sendMessage(msgAdvertenciaGrupo, { mentions: [contatoAdvertido] });
            console.log(`[SUCESSO] Advertência enviada no grupo ${chat.name} para ${senderName}`);
        } catch (groupMsgError) {
            console.error(`[ERRO] Ao enviar advertência no grupo ${chat.name}:`, groupMsgError);
        }
        
        adicionarEvento('mensagem_proibida_detectada', {
          grupo: chat.name, grupoId: groupIdSerialized,
          usuario: senderName, usuarioId: senderId,
          mensagem: messageBody, palavraDetectada: palavra,
          mensagemDeletada: mensagemDeletadaPeloBot
        });
        await aplicarAdvertencia(senderId, senderName, groupIdSerialized, chat.name, messageBody, `Uso da palavra proibida: "${palavra}"`);
        return; 
      }
    }

    // Verifica palavras sensíveis
    for (const palavra of palavrasSensiveis) {
      if (messageBodyLower.includes(palavra.toLowerCase())) {
        console.log(`[PALAVRA SENSÍVEL] "${palavra}" detectada de ${senderName} no grupo ${chat.name}`);
        adicionarEvento('mensagem_sensivel_detectada', {
          grupo: chat.name, grupoId: groupIdSerialized,
          usuario: senderName, usuarioId: senderId,
          mensagem: messageBody, palavraDetectada: palavra,
          statusRevisao: 'pendente'
        });
        // client.sendMessage("ID_CHAT_MODERADORES@g.us", `Alerta: Palavra sensível "${palavra}" usada por ${senderName} em ${chat.name}. Mensagem: "${messageBody}"`);
        break; 
      }
    }
  } catch (error) {
    console.error('[ERRO GERAL] No processamento da mensagem:', error);
  }
});

const aplicarAdvertencia = async (usuarioId, usuarioNome, grupoId, grupoNome, mensagemOriginal, motivo) => {
  advertencias = readData('advertencias'); // Garante que estamos a trabalhar com a lista mais atual
  configuracoes = readData('configuracoes'); // Garante que estamos a trabalhar com a config mais atual

  let advertenciaUsuario = advertencias.find(a => a.usuarioId === usuarioId && a.grupoId === grupoId);
  const dataAtual = new Date().toISOString();

  if (advertenciaUsuario) {
    advertenciaUsuario.mensagens.push(mensagemOriginal);
    advertenciaUsuario.data = dataAtual;
    advertenciaUsuario.count = (advertenciaUsuario.count || 0) + 1;
  } else {
    advertenciaUsuario = { usuarioId, usuarioNome, grupoId, grupoNome, mensagens: [mensagemOriginal], data: dataAtual, count: 1 };
    advertencias.push(advertenciaUsuario);
  }
  writeData('advertencias', advertencias);

  adicionarEvento('advertencia_aplicada', {
      usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId,
      motivo, mensagemOriginal, contagemAtual: advertenciaUsuario.count
  });
  console.log(`[ADVERTÊNCIA] ${advertenciaUsuario.count}/${configuracoes.limite} aplicada a ${usuarioNome} no grupo ${grupoNome}. Motivo: ${motivo}`);

  const msgPrivadaAdvertencia = `🔔 **ADVERTÊNCIA** 🔔\n\n` +
        `Você recebeu uma advertência por comportamento inadequado no grupo "${grupoNome}".\n` +
        `**Motivo:** ${motivo}\n` +
        `**Mensagem original:** "${mensagemOriginal}"\n` +
        `Esta é a sua advertência **${advertenciaUsuario.count} de ${configuracoes.limite}** permitidas.\n\n` +
        `Por favor, reveja as regras do grupo para evitar futuras sanções.`;
  try {
    if (clientReady && usuarioId) {
        console.log(`[AÇÃO] A tentar enviar PM de advertência para ${usuarioNome} (${usuarioId})`);
        await client.sendMessage(usuarioId, msgPrivadaAdvertencia);
        console.log(`[SUCESSO] PM de advertência enviada para ${usuarioNome}`);
        adicionarEvento('notificacao_privada_advertencia_enviada', { usuarioId, grupoId, contagem: advertenciaUsuario.count });
    } else {
        console.warn(`[AVISO] Cliente não pronto ou usuarioId inválido para enviar PM de advertência para ${usuarioNome}`);
    }
  } catch (pmError) {
    console.warn(`[ERRO] Não foi possível enviar PM de advertência para ${usuarioNome} (${usuarioId}):`, pmError);
    adicionarEvento('falha_notificacao_privada_advertencia', { usuarioId, grupoId, erro: pmError.message });
  }

  try {
    if (clientReady && grupoId) {
        const chatContext = await client.getChatById(grupoId);
        if (chatContext && chatContext.isGroup) {
            const admins = chatContext.participants.filter(p => p.isAdmin && !p.isMe && p.id._serialized !== usuarioId);
            const adminContacts = await Promise.all(admins.map(async admin => await client.getContactById(admin.id._serialized)));
            const contactAdvertido = await client.getContactById(usuarioId);

            if (adminContacts.length > 0) {
                const msgNotificacaoAdmins = `🔔 **Alerta de Moderação para Admins** 🔔\n`+
                    `O utilizador @${usuarioId.split('@')[0]} (${usuarioNome}) recebeu uma advertência (${advertenciaUsuario.count}/${configuracoes.limite}).\n` +
                    `**Motivo:** ${motivo}.\n` +
                    `**Mensagem:** "${mensagemOriginal}"`;
                console.log(`[AÇÃO] A tentar notificar admins no grupo ${grupoNome} sobre advertência para ${usuarioNome}`);
                await chatContext.sendMessage(msgNotificacaoAdmins, { mentions: [contactAdvertido, ...adminContacts].filter(Boolean) });
                console.log(`[SUCESSO] Notificação para admins enviada no grupo ${grupoNome}`);
                adicionarEvento('notificacao_admins_advertencia_enviada', { grupoId, usuarioId, contagem: advertenciaUsuario.count });
            } else {
                console.log(`[INFO] Nenhum outro admin encontrado no grupo ${grupoNome} para notificar sobre advertência.`);
            }
        }
    }
  } catch (adminNotifyError) {
      console.warn(`[ERRO] Ao notificar admins no grupo ${grupoNome} sobre advertência para ${usuarioNome}:`, adminNotifyError);
      adicionarEvento('falha_notificacao_admins_advertencia', { grupoId, usuarioId, erro: adminNotifyError.message });
  }

  if (advertenciaUsuario.count >= configuracoes.limite) {
    await handleReincidencia(advertenciaUsuario, mensagemOriginal);
  }
};

const handleReincidencia = async (advertenciaInfo, ultimaMensagem) => {
  const { usuarioId, usuarioNome, grupoId, grupoNome, count } = advertenciaInfo;
  configuracoes = readData('configuracoes');
  const msgAlerta = `⚠️ O utilizador @${usuarioId.split('@')[0]} (${usuarioNome}) atingiu ${count} advertências (limite: ${configuracoes.limite}) no grupo "${grupoNome}".\nÚltima infração: "${ultimaMensagem}".\nAção configurada: ${configuracoes.acao}.`;

  console.log(`[REINCIDÊNCIA] ${msgAlerta}`);
  adicionarEvento('limite_advertencias_atingido', {
      usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId,
      contagem: count, acaoConfigurada: configuracoes.acao, ultimaMensagem
  });

  if (!clientReady) {
      console.warn("[AVISO] Cliente WhatsApp não está pronto para executar ações de reincidência.");
      return;
  }

  const chat = await client.getChatById(grupoId);
  if (!chat || !chat.isGroup) {
    console.error(`[ERRO] Não foi possível encontrar o chat do grupo ${grupoNome} (${grupoId}) para ação de reincidência.`);
    return;
  }
  const contactOfensor = await client.getContactById(usuarioId);
  const admins = chat.participants.filter(p => p.isAdmin && !p.isMe && p.id._serialized !== usuarioId);
  const adminContacts = await Promise.all(admins.map(async admin => await client.getContactById(admin.id._serialized)));
  const mencoesParaAdmins = [contactOfensor, ...adminContacts].filter(Boolean);

  const acaoConfigurada = configuracoes.acao;
  console.log(`[REINCIDÊNCIA] Ação configurada: ${acaoConfigurada}`);

  if (acaoConfigurada === 'silenciar') {
    const msgParaAdmins = `🔴 ATENÇÃO ADMINS: O utilizador @${usuarioId.split('@')[0]} atingiu o limite de advertências. Ação configurada: SILENCIAR. Por favor, apliquem a restrição manualmente.`;
    console.log(`[AÇÃO REINCIDÊNCIA] Notificando admins para silenciar ${usuarioNome}`);
    await chat.sendMessage(msgParaAdmins, { mentions: mencoesParaAdmins });
    adicionarEvento('acao_sugerida_silenciar', { usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId });
  } else if (acaoConfigurada === 'expulsar') {
    console.log(`[AÇÃO REINCIDÊNCIA] Tentando expulsar ${usuarioNome} do grupo ${grupoNome}.`);
    try {
      const botIsAdmin = chat.participants.find(p => p.id._serialized === client.info.wid._serialized && p.isAdmin);
      if (botIsAdmin) {
        console.log(`[AÇÃO REINCIDÊNCIA] Bot é admin. A tentar remover ${usuarioNome}.`);
        await chat.removeParticipants([usuarioId]);
        console.log(`[SUCESSO] Usuário ${usuarioNome} expulso do grupo ${grupoNome}.`);
        await chat.sendMessage(`ℹ️ O utilizador @${usuarioId.split('@')[0]} foi REMOVIDO do grupo por atingir o limite de advertências.`, { mentions: [contactOfensor].filter(Boolean) });
        adicionarEvento('usuario_expulso_automatico', { usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId });
        advertencias = readData('advertencias').filter(a => !(a.usuarioId === usuarioId && a.grupoId === grupoId));
        writeData('advertencias', advertencias);
      } else {
        console.log(`[AVISO] Bot não é admin no grupo ${grupoNome}. Não pode expulsar ${usuarioNome}. Notificando admins.`);
        await chat.sendMessage(`🔴 ATENÇÃO ADMINS: O utilizador @${usuarioId.split('@')[0]} atingiu o limite de advertências e deve ser REMOVIDO. O bot não possui permissão para esta ação.`, { mentions: mencoesParaAdmins });
        adicionarEvento('falha_expulsao_automatica_sem_permissao', { usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId });
      }
    } catch (error) {
      console.error(`[ERRO] Ao tentar expulsar ${usuarioNome} do grupo ${grupoNome}:`, error);
      await chat.sendMessage(`🔴 ATENÇÃO ADMINS: Falha ao tentar expulsar @${usuarioId.split('@')[0]} automaticamente. Verifiquem.`, { mentions: mencoesParaAdmins });
      adicionarEvento('erro_expulsao_automatica', { usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId, erro: error.message });
    }
  } else { // Ação 'alerta'
    const msgAlertaAdmins = `🔔 ALERTA ADMINS: O utilizador @${usuarioId.split('@')[0]} atingiu o limite de advertências. Ação configurada: APENAS ALERTA.`;
    console.log(`[AÇÃO REINCIDÊNCIA] Apenas alertando admins sobre ${usuarioNome}`);
    await chat.sendMessage(msgAlertaAdmins, { mentions: mencoesParaAdmins });
    adicionarEvento('alerta_limite_advertencias', { usuario: usuarioNome, usuarioId, grupo: grupoNome, grupoId });
  }
};

client.initialize().catch(err => console.error("Erro ao inicializar cliente WhatsApp:", err));

// --- ROTAS DA API ---
// (As rotas que modificam dados agora chamam loadInitialData() para atualizar a cache em memória do bot)

app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === PAINEL_USER && senha === PAINEL_PASS) {
    return res.json({ success: true, token: 'fake-jwt-token-para-simulacao' });
  }
  return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
});

app.get('/status', (req, res) => res.json({ status: whatsappStatus, ready: clientReady }));
app.get('/qrcode', (req, res) => {
  if (qrCodeAtual && whatsappStatus !== 'Conectado') res.json({ qr: qrCodeAtual });
  else if (whatsappStatus === 'Conectado') res.json({ qr: null, message: 'WhatsApp já conectado.' });
  else res.status(404).json({ qr: null, error: 'QR Code não disponível ou WhatsApp já conectado.' });
});

app.get('/eventos', (req, res) => {
    eventosRecentes = readData('eventos_salvos');
    res.json(eventosRecentes);
});
app.get('/config', (req, res) => {
    configuracoes = readData('configuracoes');
    res.json(configuracoes);
});
app.post('/config', (req, res) => {
  const novaConfig = req.body;
  if (typeof novaConfig.limite === 'number' && typeof novaConfig.acao === 'string') {
    writeData('configuracoes', novaConfig);
    loadInitialData();
    res.json({ success: true, message: 'Configurações salvas.', configuracoes: readData('configuracoes') });
  } else {
    res.status(400).json({ success: false, message: 'Formato de configuração inválido.' });
  }
});

app.get('/listar-meus-grupos', async (req, res) => {
    if (!clientReady || whatsappStatus !== 'Conectado') {
        return res.status(503).json({ success: false, message: 'Cliente WhatsApp não está conectado ou pronto.' });
    }
    try {
        const chats = await client.getChats();
        const gruposDoBot = [];
        const botId = client.info.wid._serialized;
        for (const chat of chats) {
            if (chat.isGroup) {
                let botIsAdmin = false;
                try {
                    const groupMetadata = chat.groupMetadata || (await client.getChatById(chat.id._serialized)).groupMetadata;
                    if (groupMetadata && groupMetadata.participants) {
                         const botParticipant = groupMetadata.participants.find(p => p.id._serialized === botId);
                         if (botParticipant) botIsAdmin = botParticipant.isAdmin || botParticipant.isSuperAdmin;
                    }
                } catch (participantError) {
                    console.warn(`Aviso: Não foi possível obter status de admin para o grupo ${chat.name} (${chat.id._serialized}): ${participantError.message}`);
                }
                gruposDoBot.push({ id: chat.id._serialized, nome: chat.name, botIsAdmin: botIsAdmin });
            }
        }
        res.json({ success: true, grupos: gruposDoBot });
    } catch (error) {
        console.error("Erro ao listar grupos do bot:", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar lista de grupos.' });
    }
});


app.get('/grupos', (req, res) => {
    gruposAutorizados = readData('grupos_autorizados');
    res.json(gruposAutorizados);
});
app.post('/grupos', (req, res) => {
  const { grupo } = req.body;
  let currentGrupos = readData('grupos_autorizados');
  if (grupo && !currentGrupos.includes(grupo)) {
    currentGrupos.push(grupo);
    writeData('grupos_autorizados', currentGrupos);
    loadInitialData();
    res.json({ success: true, message: 'Grupo adicionado.', grupos: currentGrupos });
  } else if (currentGrupos.includes(grupo)) {
    res.status(400).json({ success: false, message: 'Grupo já autorizado.' });
  } else {
    res.status(400).json({ success: false, message: 'Nome/ID do grupo é obrigatório.' });
  }
});
app.delete('/grupos/:grupoId', (req, res) => {
  const grupoId = decodeURIComponent(req.params.grupoId);
  let currentGrupos = readData('grupos_autorizados');
  const initialLength = currentGrupos.length;
  currentGrupos = currentGrupos.filter(g => g !== grupoId);
  if (currentGrupos.length < initialLength) {
    writeData('grupos_autorizados', currentGrupos);
    loadInitialData();
    res.json({ success: true, message: 'Grupo removido.', grupos: currentGrupos });
  } else {
    res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
  }
});

app.get('/palavras', (req, res) => {
    palavrasProibidas = readData('palavras_proibidas');
    res.json(palavrasProibidas);
});
app.post('/palavras', (req, res) => {
  const { palavra } = req.body;
  let currentPalavras = readData('palavras_proibidas');
  if (palavra && !currentPalavras.includes(palavra.toLowerCase())) {
    currentPalavras.push(palavra.toLowerCase());
    writeData('palavras_proibidas', currentPalavras);
    loadInitialData();
    res.json({ success: true, message: 'Palavra proibida adicionada.', palavras: currentPalavras });
  } else {
    res.status(400).json({ success: false, message: 'Palavra inválida ou já existe.' });
  }
});
app.delete('/palavras/:palavra', (req, res) => {
  const palavra = decodeURIComponent(req.params.palavra).toLowerCase();
  let currentPalavras = readData('palavras_proibidas');
  const initialLength = currentPalavras.length;
  currentPalavras = currentPalavras.filter(p => p !== palavra);
  if (currentPalavras.length < initialLength) {
    writeData('palavras_proibidas', currentPalavras);
    loadInitialData();
    res.json({ success: true, message: 'Palavra proibida removida.', palavras: currentPalavras });
  } else {
    res.status(404).json({ success: false, message: 'Palavra não encontrada.' });
  }
});

app.get('/palavras-sensiveis', (req, res) => {
    palavrasSensiveis = readData('palavras_sensiveis');
    res.json(palavrasSensiveis);
});
app.post('/palavras-sensiveis', (req, res) => {
  const { palavra } = req.body;
  let currentPalavrasSensiveis = readData('palavras_sensiveis');
  if (palavra && !currentPalavrasSensiveis.includes(palavra.toLowerCase())) {
    currentPalavrasSensiveis.push(palavra.toLowerCase());
    writeData('palavras_sensiveis', currentPalavrasSensiveis);
    loadInitialData();
    res.json({ success: true, message: 'Palavra sensível adicionada.', palavrasSensiveis: currentPalavrasSensiveis });
  } else {
    res.status(400).json({ success: false, message: 'Palavra inválida ou já existe.' });
  }
});
app.delete('/palavras-sensiveis/:palavra', (req, res) => {
  const palavra = decodeURIComponent(req.params.palavra).toLowerCase();
  let currentPalavrasSensiveis = readData('palavras_sensiveis');
  const initialLength = currentPalavrasSensiveis.length;
  currentPalavrasSensiveis = currentPalavrasSensiveis.filter(p => p !== palavra);
  if (currentPalavrasSensiveis.length < initialLength) {
    writeData('palavras_sensiveis', currentPalavrasSensiveis);
    loadInitialData();
    res.json({ success: true, message: 'Palavra sensível removida.', palavrasSensiveis: currentPalavrasSensiveis });
  } else {
    res.status(404).json({ success: false, message: 'Palavra não encontrada.' });
  }
});

app.get('/advertencias', (req, res) => {
    advertencias = readData('advertencias');
    res.json(advertencias);
});
app.post('/advertencias', (req, res) => {
  const { usuarioId, usuarioNome, grupoId, grupoNome, mensagem, motivo } = req.body.advertencia;
  if (!usuarioId || !grupoId || !mensagem) {
    return res.status(400).json({ success: false, message: "Dados insuficientes para advertência." });
  }
  aplicarAdvertencia(usuarioId, usuarioNome || "N/A", grupoId, grupoNome || "N/A", mensagem, motivo || "Manual (Painel)");
  res.json({ success: true, message: "Advertência aplicada manualmente." });
});

app.get('/banidos', (req, res) => {
    usuariosBanidos = readData('usuarios_banidos');
    res.json(usuariosBanidos);
});
app.post('/banir', async (req, res) => {
  const { usuarioId, grupoId } = req.body;
  let currentBanidos = readData('usuarios_banidos');
  if (!usuarioId) return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório.' });
  if (!currentBanidos.includes(usuarioId)) {
    currentBanidos.push(usuarioId);
    writeData('usuarios_banidos', currentBanidos);
    loadInitialData();
  }
  if (grupoId && clientReady) {
      try {
          const chat = await client.getChatById(grupoId);
          if (chat.isGroup) {
              const botIsAdmin = chat.participants.find(p => p.id._serialized === client.info.wid._serialized && p.isAdmin);
              if (botIsAdmin) {
                  await chat.removeParticipants([usuarioId]);
                  console.log(`Usuário ${usuarioId} banido e removido do grupo ${grupoId}`);
                  adicionarEvento('usuario_removido_por_ban_painel', { usuarioId, grupoId });
              } else {
                  console.log(`Usuário ${usuarioId} banido, mas bot não é admin para remover do grupo ${grupoId}.`);
              }
          }
      } catch (error) {
          console.error(`Erro ao tentar remover usuário banido ${usuarioId} do grupo ${grupoId}:`, error);
      }
  }
  res.json({ success: true, message: `Usuário ${usuarioId} banido.` });
});
app.delete('/banir/:usuarioId', (req, res) => {
  const usuarioId = decodeURIComponent(req.params.usuarioId);
  let currentBanidos = readData('usuarios_banidos');
  const initialLength = currentBanidos.length;
  currentBanidos = currentBanidos.filter(id => id !== usuarioId);
  if (currentBanidos.length < initialLength) {
    writeData('usuarios_banidos', currentBanidos);
    loadInitialData();
    res.json({ success: true, message: `Banimento do usuário ${usuarioId} removido.` });
  } else {
    res.status(404).json({ success: false, message: 'Usuário não encontrado na lista de banidos.' });
  }
});

app.get('/relatorios', (req, res) => {
    const relatoriosSalvos = readData('relatorios_salvos');
    res.json(relatoriosSalvos);
});

app.post('/denuncias/registrar', (req, res) => {
    const { denunciadoNome, denunciadoId, motivo, mensagemInfracao, dataOcorrido, grupoId, grupoNome, denuncianteInfo } = req.body;
    if (!denunciadoNome || !motivo || !mensagemInfracao) {
        return res.status(400).json({ success: false, message: "Nome do denunciado, motivo e mensagem da infração são obrigatórios." });
    }
    adicionarEvento('denuncia_manual_painel', {
        grupo: grupoNome || 'N/A', grupoId: grupoId || 'N/A',
        denunciadoNome, denunciadoId: denunciadoId || 'N/A',
        motivoDenuncia: motivo, mensagemInfracao,
        dataOcorrido: dataOcorrido || new Date().toISOString(),
        denuncianteInfo: denuncianteInfo || 'Painel de Moderação',
        statusRevisao: 'pendente'
    });
    res.json({ success: true, message: "Denúncia registrada manualmente e aguardando revisão." });
});

app.post('/eventos/:id/revisar', (req, res) => {
    const eventoId = req.params.id;
    const { acao, comentarioModerador } = req.body;
    eventosRecentes = readData('eventos_salvos');
    const eventoIndex = eventosRecentes.findIndex(e => e.id === eventoId);

    if (eventoIndex === -1) return res.status(404).json({ success: false, message: "Evento não encontrado." });

    const eventoParaRevisar = eventosRecentes[eventoIndex];
    const dadosDenuncia = eventoParaRevisar.dados;
    const idUsuarioParaAdvertir = dadosDenuncia.denunciadoId || dadosDenuncia.usuarioId;
    const nomeUsuarioParaAdvertir = dadosDenuncia.denunciadoNome || dadosDenuncia.usuario || 'N/A';
    const idGrupoParaAdvertir = dadosDenuncia.grupoId;
    const nomeGrupoParaAdvertir = dadosDenuncia.grupo || 'N/A';
    const mensagemDaInfracao = dadosDenuncia.mensagemInfracao || dadosDenuncia.mensagem;
    const motivoOriginalDenuncia = dadosDenuncia.motivoDenuncia || eventoParaRevisar.tipo;

    if (acao === 'aprovar_advertencia') {
        if (!idUsuarioParaAdvertir || !idGrupoParaAdvertir || !mensagemDaInfracao) {
             return res.status(400).json({ success: false, message: "Dados insuficientes no evento para aplicar advertência." });
        }
        aplicarAdvertencia(
            idUsuarioParaAdvertir, nomeUsuarioParaAdvertir,
            idGrupoParaAdvertir, nomeGrupoParaAdvertir,
            mensagemDaInfracao,
            `Denúncia aprovada: ${motivoOriginalDenuncia}. Comentário: ${comentarioModerador || 'N/A'}`
        );
        eventosRecentes[eventoIndex].dados.statusRevisao = 'aprovada_advertencia_aplicada';
        eventosRecentes[eventoIndex].dados.comentarioModerador = comentarioModerador;
        writeData('eventos_salvos', eventosRecentes);
        res.json({ success: true, message: "Denúncia aprovada, advertência aplicada." });

    } else if (acao === 'rejeitar_denuncia') {
        eventosRecentes[eventoIndex].dados.statusRevisao = 'rejeitada';
        eventosRecentes[eventoIndex].dados.comentarioModerador = comentarioModerador;
        writeData('eventos_salvos', eventosRecentes);
        adicionarEvento('denuncia_rejeitada_painel', {
            eventoOriginalId: eventoId, motivoOriginal: motivoOriginalDenuncia,
            denunciadoNome: nomeUsuarioParaAdvertir, comentarioModerador, grupo: nomeGrupoParaAdvertir
        });
        res.json({ success: true, message: "Denúncia rejeitada." });
    } else {
        res.status(400).json({ success: false, message: "Ação de revisão inválida." });
    }
});

app.post('/silenciar', async (req, res) => {
    const { usuarioId, grupoId } = req.body;
    if (!usuarioId || !grupoId || !clientReady) {
        return res.status(400).json({ success: false, message: "Dados insuficientes ou cliente WhatsApp não pronto." });
    }
    console.log(`[PAINEL] Tentativa de silenciar ${usuarioId} em ${grupoId}`);
    try {
        const chat = await client.getChatById(grupoId);
        const adminsDoGrupo = chat.participants.filter(p => p.isAdmin && !p.isMe).map(p => p.id._serialized);
        const mencoesAdmins = await Promise.all(adminsDoGrupo.map(async adminId => await client.getContactById(adminId)));
        const contactAlvo = await client.getContactById(usuarioId);

        await chat.sendMessage(`MODERADORES: Ação de SILENCIAR solicitada para @${usuarioId.split('@')[0]} neste grupo. (Ação manual requerida)`, { mentions: [contactAlvo, ...mencoesAdmins].filter(Boolean) });
        adicionarEvento('solicitacao_silenciar_usuario', { usuarioId, grupoId, usuarioNome: contactAlvo.pushname || contactAlvo.name });
        res.json({ success: true, message: `Notificação para silenciar ${contactAlvo.pushname || usuarioId} enviada aos admins do grupo.` });
    } catch (error) {
        console.error("Erro ao tentar notificar para silenciar:", error);
        res.status(500).json({ success: false, message: "Erro ao processar solicitação de silenciamento." });
    }
});

app.post('/expulsar', async (req, res) => {
    const { usuarioId, grupoId } = req.body;
    if (!usuarioId || !grupoId || !clientReady) {
        return res.status(400).json({ success: false, message: "Dados insuficientes ou cliente WhatsApp não pronto." });
    }
    const contatoAlvo = await client.getContactById(usuarioId);
    const nomeUsuarioAlvo = contatoAlvo.pushname || contatoAlvo.name || usuarioId;
    console.log(`[PAINEL] Tentativa de expulsar ${nomeUsuarioAlvo} de ${grupoId}`);
    try {
        const chat = await client.getChatById(grupoId);
        if (chat.isGroup) {
            const botIsAdmin = chat.participants.find(p => p.id._serialized === client.info.wid._serialized && p.isAdmin);
            if (botIsAdmin) {
                await chat.removeParticipants([usuarioId]);
                adicionarEvento('usuario_expulso_painel', { usuario: nomeUsuarioAlvo, usuarioId, grupoId, grupoNome: chat.name });
                advertencias = readData('advertencias').filter(a => !(a.usuarioId === usuarioId && a.grupoId === grupoId));
                writeData('advertencias', advertencias);
                res.json({ success: true, message: `Usuário ${nomeUsuarioAlvo} expulso do grupo ${chat.name}.` });
            } else {
                const adminsDoGrupo = chat.participants.filter(p => p.isAdmin && !p.isMe).map(p => p.id._serialized);
                const mencoesAdmins = await Promise.all(adminsDoGrupo.map(async adminId => await client.getContactById(adminId)));
                await chat.sendMessage(`MODERADORES: Ação de EXPULSÃO solicitada para @${usuarioId.split('@')[0]}. Bot não é admin. (Ação manual requerida)`, { mentions: [contatoAlvo, ...mencoesAdmins].filter(Boolean) });
                adicionarEvento('tentativa_expulsao_painel_sem_permissao', { usuario: nomeUsuarioAlvo, usuarioId, grupoId, grupoNome: chat.name });
                res.status(403).json({ success: false, message: "Bot não é admin no grupo. Notificando admins." });
            }
        } else {
            res.status(400).json({ success: false, message: "Chat não é um grupo." });
        }
    } catch (error) {
        console.error(`Erro ao tentar expulsar usuário ${nomeUsuarioAlvo} pelo painel:`, error);
        res.status(500).json({ success: false, message: "Erro ao processar expulsão." });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor do Painel de Moderação rodando em http://localhost:${PORT}`);
  console.log(`Pasta de dados: ${DATA_DIR}`);
});
