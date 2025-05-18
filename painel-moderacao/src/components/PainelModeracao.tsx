'use client';

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertCircle, CheckCircle, Trash2, Plus, WifiOff, Wifi, Moon, SunMedium, Users,
    FileText, Flag, Search, Send, ListChecks, XCircle, Ban, Check as CheckIcon, Clock, UserX,
    AlertTriangle, Settings, MessageCircle, ShieldAlert, BarChart, List, LogOut, Home,
    UserPlus, KeyRound, RefreshCw, Loader2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Textarea } from '@/components/ui/textarea';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

// Cores para o gráfico de pizza (exemplo)
const coresGrafico = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#d84a4a', '#00C49F', '#FFBB28', '#FF8042'];
const API_BASE_URL = 'http://localhost:3001';

// Definição das interfaces
interface Evento {
    id: string;
    tipo: string; // Adicionado para diferenciar tipos de evento
    dados: {
        timestamp: string;
        usuario?: string; // Opcional, pois nem todo evento tem usuário direto
        usuarioId?: string;
        grupo?: string;
        grupoId?: string;
        mensagem?: string;
        palavraDetectada?: string;
        contagemAtual?: number;
        acaoConfigurada?: string;
        motivo?: string;
    };
}

interface Advertencia {
    usuarioId: string;
    usuarioNome?: string; // Adicionado para exibição
    grupoId: string;
    grupoNome?: string; // Adicionado para exibição
    mensagens: string[];
    data: string;
    count: number; // Contagem de advertências
}

interface Relatorio {
    grupoId: string;
    usuarioId: string;
    tipoOfensa: string;
    data: string;
    mensagem: string;
}

const MAX_ADVERTENCIAS = 3;

interface NavItem {
    label: string;
    value: string;
    icon: React.ReactNode;
}

// Interface para os grupos listados do WhatsApp do bot
interface MeuGrupoWhatsapp {
    id: string;
    nome: string;
    botIsAdmin: boolean;
}

const navItems: NavItem[] = [
    { label: 'Dashboard', value: 'dashboard', icon: <Home className="mr-2 h-4 w-4" /> },
    { label: 'Configurações', value: 'configuracoes', icon: <Settings className="mr-2 h-4 w-4" /> },
    { label: 'Moderação', value: 'moderacao', icon: <ShieldAlert className="mr-2 h-4 w-4" /> },
    { label: 'Histórico', value: 'historico', icon: <List className="mr-2 h-4 w-4" /> },
    { label: 'Relatórios', value: 'relatorios', icon: <BarChart className="mr-2 h-4 w-4" /> },
    { label: 'Banidos', value: 'banidos', icon: <UserX className="mr-2 h-4 w-4" /> },
    { label: 'Registro', value: 'registro', icon: <ListChecks className="mr-2 h-4 w-4" /> },
];

const PainelModeracao = () => {
    const [qr, setQr] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');
    const [isClientReady, setIsClientReady] = useState<boolean>(false);
    const [gruposMonitorados, setGruposMonitorados] = useState<string[]>([]); // IDs dos grupos monitorados
    const [grupoNovo, setGrupoNovo] = useState('');
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [filtro, setFiltro] = useState('');
    const [palavrasProibidas, setPalavrasProibidas] = useState<string[]>([]);
    const [novaPalavraProibida, setNovaPalavraProibida] = useState('');
    const [config, setConfig] = useState({ limite: MAX_ADVERTENCIAS, acao: 'alerta' });
    const [loading, setLoading] = useState({ global: false, gruposWhatsapp: false });
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { setTheme, theme } = useTheme();
    const [isMobile, setIsMobile] = useState(false);
    const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
    const [palavrasSensiveis, setPalavrasSensiveis] = useState<string[]>([]);
    const [novaPalavraSensivel, setNovaPalavraSensivel] = useState<string>('');
    const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
    const [mensagemRevisao, setMensagemRevisao] = useState<string>('');
    const [eventoParaRevisar, setEventoParaRevisar] = useState<Evento | null>(null);
    const [usuariosBanidos, setUsuariosBanidos] = useState<string[]>([]);
    const [activeSection, setActiveSection] = useState<string>('dashboard');
    const [GraficoOfensasCliente, setGraficoOfensasCliente] = useState<React.ComponentType<any> | null>(null);
    const [meusGruposWhatsapp, setMeusGruposWhatsapp] = useState<MeuGrupoWhatsapp[]>([]);
    const [grupoSelecionadoParaAdicionar, setGrupoSelecionadoParaAdicionar] = useState<string>('');


    useEffect(() => {
        import('@/components/GraficoOfensasCliente') // Certifique-se que este caminho está correto e o componente existe
            .then(module => setGraficoOfensasCliente(() => module.default))
            .catch(err => {
                // Log detalhado do erro no console do navegador para depuração
                console.error("Falha detalhada ao carregar GraficoOfensasCliente:", err);

                let errorMessage = "Falha ao carregar o componente do gráfico. ";
                if (err && err.message) {
                    errorMessage += `Detalhe: ${err.message}. `;
                } else if (typeof err === 'string' && err) {
                    errorMessage += `Detalhe: ${err}. `;
                }
                errorMessage += "Verifique o caminho do arquivo ('@/components/GraficoOfensasCliente'), o nome do componente e se há erros internos no próprio GraficoOfensasCliente. Veja o console do navegador para mais informações técnicas.";
                setError(errorMessage); // Define uma mensagem de erro mais informativa para a UI
            });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(prev => ({ ...prev, global: true }));
        // setError(null); // Comentar ou remover para não limpar erros importantes (ex: falha ao carregar gráfico)

        const endpoints = {
            qrcode: `${API_BASE_URL}/qrcode`,
            status: `${API_BASE_URL}/status`,
            grupos: `${API_BASE_URL}/grupos`,
            eventos: `${API_BASE_URL}/eventos`,
            palavras: `${API_BASE_URL}/palavras`,
            config: `${API_BASE_URL}/config`,
            advertencias: `${API_BASE_URL}/advertencias`,
            palavrasSensiveis: `${API_BASE_URL}/palavras-sensiveis`,
            relatorios: `${API_BASE_URL}/relatorios`,
            banidos: `${API_BASE_URL}/banidos`,
        };

        try {
            const requests = Object.entries(endpoints).map(([key, url]) =>
                axios.get(url).then(response => ({ key, data: response.data, success: true }))
                .catch(error => {
                    console.warn(`Falha ao buscar ${key}:`, error.response?.data?.message || error.message);
                    return { key, data: null, success: false, error: error.response?.data?.message || error.message };
                })
            );
            const responses = await Promise.all(requests);

            responses.forEach(res => {
                if (res.success) {
                    switch (res.key) {
                        case 'qrcode': setQr(res.data.qr); break;
                        case 'status':
                            setStatus(res.data.status);
                            setIsClientReady(res.data.ready === true);
                            if (!res.data.qr && res.data.status !== 'Conectado') setQr(null);
                            break;
                        case 'grupos': setGruposMonitorados(Array.isArray(res.data) ? res.data : []); break;
                        case 'eventos': setEventos(Array.isArray(res.data) ? res.data : []); break;
                        case 'palavras': setPalavrasProibidas(Array.isArray(res.data) ? res.data : []); break;
                        case 'config': setConfig(res.data || { limite: MAX_ADVERTENCIAS, acao: 'alerta' }); break;
                        case 'advertencias': setAdvertencias(Array.isArray(res.data) ? res.data : []); break;
                        case 'palavrasSensiveis': setPalavrasSensiveis(Array.isArray(res.data) ? res.data : []); break;
                        case 'relatorios': setRelatorios(Array.isArray(res.data) ? res.data : []); break;
                        case 'banidos': setUsuariosBanidos(Array.isArray(res.data) ? res.data : []); break;
                        default: break;
                    }
                } else if (res.key === 'status' || res.key === 'qrcode') {
                    // Não sobrepor o erro do gráfico se já existir um
                    if (!error) {
                        setError(prevError => prevError ? `${prevError}\nErro ${res.key}: ${res.error}` : `Erro ${res.key}: ${res.error}`);
                    }
                }
            });

        } catch (err: any) {
            if (!error) { // Não sobrepor o erro do gráfico
                setError('Erro geral ao buscar dados. Verifique o console.');
            }
            console.error("Erro geral em fetchData:", err);
        } finally {
            setLoading(prev => ({ ...prev, global: false }));
        }
    }, [error]); // Adicionado 'error' como dependência para evitar sobreposição de erro

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };
    const showError = (message: string) => {
        setError(message);
        // setTimeout(() => setError(null), 5000);
    };


    const atualizarConfig = async () => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            await axios.post(`${API_BASE_URL}/config`, config);
            showSuccess('Configurações salvas!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro ao salvar configurações.'); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };

    const agruparPorOfensa = () => {
        const contagem: { [key: string]: number } = {};
        eventos.forEach(e => {
            if (e.tipo === 'mensagem_proibida' && e.dados.palavraDetectada) {
                const key = `Proibida: ${e.dados.palavraDetectada}`;
                contagem[key] = (contagem[key] || 0) + 1;
            } else if (e.tipo === 'mensagem_sensivel' && e.dados.palavraDetectada) {
                const key = `Sensível: ${e.dados.palavraDetectada}`;
                contagem[key] = (contagem[key] || 0) + 1;
            }
        });
        return Object.entries(contagem).map(([name, value]) => ({ name, value }));
    };

    const eventosFiltrados = eventos
        .filter(e =>
            e.dados?.usuario?.toLowerCase().includes(filtro.toLowerCase()) ||
            e.dados?.grupo?.toLowerCase().includes(filtro.toLowerCase()) ||
            e.dados?.mensagem?.toLowerCase().includes(filtro.toLowerCase()) ||
            e.tipo.toLowerCase().includes(filtro.toLowerCase())
        )
        .sort((a, b) => new Date(b.dados.timestamp).getTime() - new Date(a.dados.timestamp).getTime());

    const adicionarAdvertencia = async (evento: Evento) => {
        if (!evento.dados.usuarioId || !evento.dados.grupoId || !evento.dados.mensagem) {
            showError("Dados insuficientes no evento para aplicar advertência.");
            return;
        }
        setLoading(prev => ({...prev, global: true})); setError(null);
        const payload = {
            usuarioId: evento.dados.usuarioId,
            usuarioNome: evento.dados.usuario,
            grupoId: evento.dados.grupoId,
            grupoNome: evento.dados.grupo,
            mensagem: evento.dados.mensagem,
            motivo: `Detectado em evento: ${evento.tipo}`
        };
        try {
            await axios.post(`${API_BASE_URL}/advertencias`, { advertencia: payload });
            showSuccess(`Advertência registrada para ${evento.dados.usuario}.`);
            fetchData();
        } catch (e: any) { showError(e.response?.data?.message || e.message || "Erro ao salvar advertência."); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };

    const handleReincidencia = (evento: Evento) => {
        console.warn("Lógica de reincidência agora primariamente no backend. Frontend notifica se necessário.", evento);
    };

    const enviarMensagemGrupo = (grupoId: string, mensagem: string) => console.log(`[FRONTEND-SIM] Grupo ${grupoId}: ${mensagem}`);
    const enviarMensagemPrivada = (usuarioId: string, mensagem: string) => console.log(`[FRONTEND-SIM] DM ${usuarioId}: ${mensagem}`);

    const adicionarPalavraProibida = async () => {
        if (!novaPalavraProibida.trim()) return;
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/palavras`, { palavra: novaPalavraProibida.trim() });
            setPalavrasProibidas(response.data.palavras ? response.data.palavras : (prev => [...prev, novaPalavraProibida.trim()]));
            setNovaPalavraProibida('');
            showSuccess('Palavra proibida adicionada!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro.'); } finally { setLoading(prev => ({...prev, global: false})); }
    };
    const removerPalavraProibida = async (palavra: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.delete(`${API_BASE_URL}/palavras/${encodeURIComponent(palavra)}`);
            setPalavrasProibidas(response.data.palavras ? response.data.palavras : (prev => prev.filter(p => p !== palavra)));
            showSuccess('Palavra proibida removida!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro.'); } finally { setLoading(prev => ({...prev, global: false})); }
    };

    const adicionarPalavraSensivel = async () => {
        if (!novaPalavraSensivel.trim()) return;
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/palavras-sensiveis`, { palavra: novaPalavraSensivel.trim() });
            setPalavrasSensiveis(response.data.palavrasSensiveis ? response.data.palavrasSensiveis : (prev => [...prev, novaPalavraSensivel.trim()]));
            setNovaPalavraSensivel('');
            showSuccess('Palavra sensível adicionada!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro.'); } finally { setLoading(prev => ({...prev, global: false})); }
    };
    const removerPalavraSensivel = async (palavra: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.delete(`${API_BASE_URL}/palavras-sensiveis/${encodeURIComponent(palavra)}`);
            setPalavrasSensiveis(response.data.palavrasSensiveis ? response.data.palavrasSensiveis : (prev => prev.filter(p => p !== palavra)));
            showSuccess('Palavra sensível removida!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro.'); } finally { setLoading(prev => ({...prev, global: false})); }
    };

    const adicionarGrupoMonitorado = async (idGrupoParaAdicionar?: string) => {
        const grupoParaAdicionar = idGrupoParaAdicionar || grupoNovo;
        if (!grupoParaAdicionar.trim()) {
            showError("ID/Nome do grupo não pode ser vazio.");
            return;
        }
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/grupos`, { grupo: grupoParaAdicionar.trim() });
            setGruposMonitorados(response.data.grupos ? response.data.grupos : (prev => [...prev, grupoParaAdicionar.trim()]));
            setGrupoNovo('');
            setGrupoSelecionadoParaAdicionar('');
            showSuccess('Grupo adicionado para monitoramento!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro ao adicionar grupo.'); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };
    const removerGrupoMonitorado = async (grupoId: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const response = await axios.delete(`${API_BASE_URL}/grupos/${encodeURIComponent(grupoId)}`);
            setGruposMonitorados(response.data.grupos ? response.data.grupos : (prev => prev.filter(g => g !== grupoId)));
            showSuccess('Grupo removido do monitoramento!');
        } catch (err: any) { showError(err.response?.data?.message || err.message || 'Erro ao remover grupo.'); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };

    const listarMeusGruposWhatsapp = async () => {
        if (!isClientReady) {
            showError("O WhatsApp não está conectado. Conecte primeiro para listar os grupos.");
            return;
        }
        setLoading(prev => ({ ...prev, gruposWhatsapp: true })); setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/listar-meus-grupos`);
            if (response.data.success) {
                setMeusGruposWhatsapp(response.data.grupos || []);
                if (response.data.grupos.length === 0) {
                    showSuccess("Nenhum grupo encontrado na sua conta do WhatsApp.");
                } else {
                     showSuccess("Lista de grupos do WhatsApp carregada.");
                }
            } else {
                showError(response.data.message || "Falha ao listar grupos do WhatsApp.");
            }
        } catch (err: any) {
            showError(err.response?.data?.message || err.message || "Erro ao conectar para listar grupos.");
            console.error("Erro ao listar grupos do WhatsApp:", err);
        } finally {
            setLoading(prev => ({ ...prev, gruposWhatsapp: false }));
        }
    };


    const gerarRelatorioSemanal = () => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            const umaSemanaAtras = new Date();
            umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
            const relatorioGerado: Relatorio[] = eventos
                .filter(evento => new Date(evento.dados.timestamp) >= umaSemanaAtras && (evento.tipo === 'mensagem_proibida' || evento.tipo === 'mensagem_sensivel'))
                .map(evento => ({
                    grupoId: evento.dados.grupo || 'N/A',
                    usuarioId: evento.dados.usuario || 'N/A',
                    tipoOfensa: `${evento.tipo === 'mensagem_proibida' ? 'Palavra Proibida' : 'Palavra Sensível'}: ${evento.dados.palavraDetectada || ''}`,
                    data: evento.dados.timestamp,
                    mensagem: evento.dados.mensagem || '',
                }));
            setRelatorios(relatorioGerado);
            showSuccess(relatorioGerado.length > 0 ? 'Relatório semanal gerado!' : 'Nenhuma infração na última semana.');
        } catch (error: any) { showError(error.message || 'Erro ao gerar relatório.'); }
        finally { setLoading(prev => ({...prev, global: false}));}
    };

    const buscarHistoricoUsuario = (usuarioId: string) => {
        const historicoFiltrado = advertencias.filter(adv => adv.usuarioId === usuarioId || adv.usuarioNome?.toLowerCase().includes(usuarioId.toLowerCase()));
        if (historicoFiltrado.length === 0) return `Não há histórico de advertências para ${usuarioId}.`;
        let mensagem = `📄 Histórico de advertências de ${usuarioId}:\n`;
        historicoFiltrado.forEach(adv => {
            mensagem += `- Em ${new Date(adv.data).toLocaleString()} no grupo ${adv.grupoNome || adv.grupoId} (${adv.count} adv):\n`;
            adv.mensagens.forEach((msg, idx) => mensagem += `  ${idx + 1}. "${msg}"\n`);
        });
        return mensagem;
    };

    const handleDenuncia = (evento: Evento) => {
        setEventoParaRevisar(evento);
        setMensagemRevisao(evento.dados.mensagem || '');
        setActiveSection('registro');
        showSuccess('Mensagem enviada para revisão na seção "Registro".');
    };

    const aprovarRevisao = async () => {
        if (!eventoParaRevisar) { showError("Nenhuma mensagem para aprovar."); return; }
        adicionarAdvertencia(eventoParaRevisar);
        setEventoParaRevisar(null);
        setMensagemRevisao('');
    };

    const reprovarRevisao = async () => {
        if (!eventoParaRevisar) { showError("Nenhuma mensagem para reprovar."); return; }
        console.log('Mensagem reprovada (denúncia ignorada):', eventoParaRevisar.dados.mensagem);
        setEventoParaRevisar(null);
        setMensagemRevisao('');
        showSuccess('Denúncia ignorada.');
    };

    const banirUsuario = async (usuarioId: string) => {
        if (!usuarioId.trim()) { showError("ID do usuário é obrigatório."); return; }
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            await axios.post(`${API_BASE_URL}/banir`, { usuarioId });
            setUsuariosBanidos(prev => [...prev, usuarioId]); // Atualização otimista
            showSuccess(`Usuário ${usuarioId} banido.`);
             fetchData(); // Rebuscar para consistência
        } catch (e: any) { showError(e.response?.data?.message || e.message || "Erro ao banir."); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };
    const removerBanimento = async (usuarioId: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            await axios.delete(`${API_BASE_URL}/banir/${usuarioId}`);
            setUsuariosBanidos(prev => prev.filter(id => id !== usuarioId)); // Atualização otimista
            showSuccess(`Banimento de ${usuarioId} removido.`);
            fetchData(); // Rebuscar
        } catch (e: any) { showError(e.response?.data?.message || e.message || "Erro ao remover banimento."); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };
    const silenciarUsuario = async (usuarioId: string, grupoId: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            await axios.post(`${API_BASE_URL}/silenciar`, { usuarioId, grupoId });
            showSuccess(`Solicitação para silenciar ${usuarioId} no grupo ${grupoId} enviada.`);
        } catch (e: any) { showError(e.response?.data?.message || e.message || "Erro ao silenciar."); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };
    const expulsarUsuario = async (usuarioId: string, grupoId: string) => {
        setLoading(prev => ({...prev, global: true})); setError(null);
        try {
            await axios.post(`${API_BASE_URL}/expulsar`, { usuarioId, grupoId });
            showSuccess(`Solicitação para expulsar ${usuarioId} do grupo ${grupoId} enviada.`);
            fetchData(); // Rebuscar advertências e outros dados
        } catch (e: any) { showError(e.response?.data?.message || e.message || "Erro ao expulsar."); }
        finally { setLoading(prev => ({...prev, global: false})); }
    };

    const verificarTempoDenuncia = (timestampDenuncia: string) => {
        const diffMs = new Date().getTime() - new Date(timestampDenuncia).getTime();
        return diffMs / (1000 * 60 * 60);
    };

    const renderSection = () => {
        const cardClasses = "transition-all duration-300 transform hover:scale-[1.01] hover:shadow-xl dark:bg-gray-800 dark:border dark:border-gray-700";
        const inputClasses = "text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500";
        const labelClasses = "text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1";
        const descriptionClasses = "text-xs text-gray-500 dark:text-gray-400";
        const tableHeaderClasses = "border-b dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider";
        const tableCellClasses = "px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300";
        const tableRowClasses = "hover:bg-gray-50 dark:hover:bg-gray-700/50";

        switch (activeSection) {
            case 'dashboard':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Dashboard</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className={cardClasses}>
                                <CardHeader>
                                    <CardTitle className="flex items-center text-lg"><Wifi className="mr-2 h-5 w-5 text-blue-500" />Status do WhatsApp</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className={`font-semibold text-lg ${status === 'Conectado' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {loading.global && !status ? 'Verificando...' : status || 'Desconectado'}
                                        {status === 'Conectado' ? <Wifi className="inline-block ml-2 h-5 w-5" /> : (status ? <WifiOff className="inline-block ml-2 h-5 w-5" /> : null)}
                                    </p>
                                    {qr && status !== 'Conectado' && (
                                        <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Escaneie o QR Code:</h3>
                                            <img src={qr} alt="QR Code" className="w-48 h-48 border p-1 mt-1 rounded-md shadow-sm dark:border-gray-600" />
                                        </div>
                                    )}
                                    {loading.global && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Carregando status...</p>}
                                </CardContent>
                            </Card>
                            <Card className={cardClasses}>
                                <CardHeader>
                                    <CardTitle className="flex items-center text-lg"><BarChart className="mr-2 h-5 w-5 text-purple-500" />Gráfico de Ofensas</CardTitle>
                                    <CardDescription className={descriptionClasses}>Distribuição das ofensas detectadas.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-64 flex items-center justify-center">
                                    {GraficoOfensasCliente && !loading.global ? (
                                        agruparPorOfensa().length > 0 ?
                                        <GraficoOfensasCliente data={agruparPorOfensa()} isMobile={isMobile} theme={theme} />
                                        : <p className="text-gray-500 dark:text-gray-400">Nenhuma ofensa registrada.</p>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400">{loading.global ? 'Carregando gráfico...' : 'Componente do gráfico não pôde ser carregado.'}</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                );
            case 'configuracoes':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Configurações</h2>
                        <Card className={cardClasses}>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg"><Settings className="mr-2 h-5 w-5"/>Configurações Automáticas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <label htmlFor="limiteAdvertencias" className={labelClasses}>Limite de advertências</label>
                                    <Input id="limiteAdvertencias" type="number" value={config.limite}
                                        onChange={e => setConfig({ ...config, limite: parseInt(e.target.value) || 1 })}
                                        className={inputClasses} min="1" />
                                </div>
                                <div>
                                    <label htmlFor="acaoAutomatica" className={labelClasses}>Ação automática</label>
                                    <Select onValueChange={(value) => setConfig({ ...config, acao: value })} value={config.acao}>
                                        <SelectTrigger id="acaoAutomatica" className={cn(inputClasses, "w-full")}>
                                            <SelectValue placeholder="Selecione uma ação" />
                                        </SelectTrigger>
                                        <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                            <SelectItem value="alerta" className="dark:hover:bg-gray-600 dark:focus:bg-gray-600">Apenas alerta</SelectItem>
                                            <SelectItem value="silenciar" className="dark:hover:bg-gray-600 dark:focus:bg-gray-600">Sugerir Silenciar</SelectItem>
                                            <SelectItem value="expulsar" className="dark:hover:bg-gray-600 dark:focus:bg-gray-600">Sugerir Expulsão</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={atualizarConfig} className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-all duration-300 transform hover:scale-105" disabled={loading.global}>
                                    {loading.global ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {loading.global ? 'Salvando...' : 'Salvar Configurações'}
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                );
            case 'moderacao':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Moderação de Conteúdo</h2>
                        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-6`}>
                            <Card className={cn(cardClasses, "lg:col-span-1")}>
                                <CardHeader>
                                    <CardTitle className="flex items-center text-lg"><Users className="mr-2 h-5 w-5 text-green-500"/>Grupos Monitorados</CardTitle>
                                    <CardDescription className={descriptionClasses}>Adicione ou remova grupos para monitoramento.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4">
                                        <Button onClick={listarMeusGruposWhatsapp} className="w-full mb-2 text-sm bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white" disabled={!isClientReady || loading.gruposWhatsapp}>
                                            {loading.gruposWhatsapp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            {loading.gruposWhatsapp ? "Carregando..." : (meusGruposWhatsapp.length > 0 ? "Atualizar Lista de Grupos" : "Carregar Meus Grupos do WhatsApp")}
                                        </Button>
                                        {meusGruposWhatsapp.length > 0 && (
                                            <div className="flex gap-2 mb-3">
                                                <Select value={grupoSelecionadoParaAdicionar} onValueChange={setGrupoSelecionadoParaAdicionar}>
                                                    <SelectTrigger className={cn(inputClasses, "flex-grow")}>
                                                        <SelectValue placeholder="Selecione um grupo para adicionar" />
                                                    </SelectTrigger>
                                                    <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                        {meusGruposWhatsapp.map(g => (
                                                            <SelectItem key={g.id} value={g.id} className="dark:hover:bg-gray-600 dark:focus:bg-gray-600">
                                                                {g.nome} {g.botIsAdmin ? '(Admin)' : ''} ({gruposMonitorados.includes(g.id) ? 'Já monitorado' : 'Não monitorado'})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button onClick={() => adicionarGrupoMonitorado(grupoSelecionadoParaAdicionar)} disabled={loading.global || !grupoSelecionadoParaAdicionar || gruposMonitorados.includes(grupoSelecionadoParaAdicionar)} className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"><Plus className="h-4 w-4" /></Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <Input type="text" placeholder="Ou ID manual do grupo" value={grupoNovo} onChange={(e) => setGrupoNovo(e.target.value)} className={inputClasses} />
                                        <Button onClick={() => adicionarGrupoMonitorado()} disabled={loading.global || !grupoNovo.trim() || gruposMonitorados.includes(grupoNovo.trim())} className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"><Plus className="mr-1 h-4 w-4" />Add</Button>
                                    </div>
                                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">{gruposMonitorados.map((g, i) => (<li key={i} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/80 p-2 rounded text-sm"><span className="truncate max-w-[75%]">{meusGruposWhatsapp.find(mg => mg.id === g)?.nome || g}</span><Button onClick={() => removerGrupoMonitorado(g)} variant="destructive" size="icon" className="h-7 w-7" disabled={loading.global}><Trash2 className="h-4 w-4" /></Button></li>))}{loading.global && !gruposMonitorados.length && <p className={descriptionClasses}>Carregando...</p>}{!loading.global && !gruposMonitorados.length && <p className={descriptionClasses}>Nenhum grupo monitorado.</p>}</ul>
                                </CardContent>
                            </Card>
                            {/* Cards de Palavras Proibidas e Sensíveis permanecem os mesmos, mas com 'loading.global' */}
                             <Card className={cn(cardClasses, "lg:col-span-1")}>
                                <CardHeader><CardTitle className="flex items-center text-lg"><Ban className="mr-2 h-5 w-5 text-red-500"/>Palavras Proibidas</CardTitle><CardDescription className={descriptionClasses}>Geram advertência.</CardDescription></CardHeader>
                                <CardContent>
                                    <div className="flex gap-2 mb-3"><Input type="text" placeholder="Nova palavra proibida" value={novaPalavraProibida} onChange={(e) => setNovaPalavraProibida(e.target.value)} className={inputClasses} /><Button onClick={adicionarPalavraProibida} disabled={loading.global} className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"><Plus className="mr-1 h-4 w-4" />Add</Button></div>
                                    <ul className="space-y-1 max-h-60 overflow-y-auto pr-1">{palavrasProibidas.map((p, i) => (<li key={i} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/80 p-2 rounded text-sm">{p}<Button onClick={() => removerPalavraProibida(p)} variant="destructive" size="icon" className="h-7 w-7" disabled={loading.global}><Trash2 className="h-4 w-4" /></Button></li>))}{loading.global && !palavrasProibidas.length && <p className={descriptionClasses}>Carregando...</p>}{!loading.global && !palavrasProibidas.length && <p className={descriptionClasses}>Nenhuma palavra.</p>}</ul>
                                </CardContent>
                            </Card>
                            <Card className={cn(cardClasses, "lg:col-span-1")}>
                                <CardHeader><CardTitle className="flex items-center text-lg"><AlertTriangle className="mr-2 h-5 w-5 text-yellow-500"/>Palavras Sensíveis</CardTitle><CardDescription className={descriptionClasses}>Registradas para alerta.</CardDescription></CardHeader>
                                <CardContent>
                                    <div className="flex gap-2 mb-3"><Input type="text" placeholder="Nova palavra sensível" value={novaPalavraSensivel} onChange={(e) => setNovaPalavraSensivel(e.target.value)} className={inputClasses} /><Button onClick={adicionarPalavraSensivel} disabled={loading.global} className="bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white"><Plus className="mr-1 h-4 w-4" />Add</Button></div>
                                    <ul className="space-y-1 max-h-60 overflow-y-auto pr-1">{palavrasSensiveis.map((p, i) => (<li key={i} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/80 p-2 rounded text-sm">{p}<Button onClick={() => removerPalavraSensivel(p)} variant="destructive" size="icon" className="h-7 w-7" disabled={loading.global}><Trash2 className="h-4 w-4" /></Button></li>))}{loading.global && !palavrasSensiveis.length && <p className={descriptionClasses}>Carregando...</p>}{!loading.global && !palavrasSensiveis.length && <p className={descriptionClasses}>Nenhuma palavra.</p>}</ul>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                );
            case 'historico':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Histórico Detalhado</h2>
                        <Card className={cardClasses}>
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg"><List className="mr-2 h-5 w-5 text-indigo-500"/>Eventos Registrados</CardTitle>
                                <CardDescription className={descriptionClasses}>Lista de todos os eventos e ações.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                    <Input type="text" placeholder="Filtrar por usuário, grupo, mensagem ou tipo" className={cn(inputClasses, "flex-grow")} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                                    <Button onClick={() => { const uid = prompt('ID ou nome do usuário para histórico de advertências:'); if (uid) alert(buscarHistoricoUsuario(uid)); }} className="bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-sm"><Search className="mr-1 h-4 w-4" />Buscar Advertências</Button>
                                </div>
                                <div className="overflow-x-auto max-h-[60vh] rounded-md border dark:border-gray-700">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700/80 sticky top-0 z-10"><tr><th className={tableHeaderClasses}>Data</th><th className={tableHeaderClasses}>Tipo</th><th className={tableHeaderClasses}>Usuário</th><th className={tableHeaderClasses}>Grupo</th><th className={tableHeaderClasses}>Detalhes</th><th className={tableHeaderClasses}>Ações</th></tr></thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {eventosFiltrados.map((e) => {
                                                const isProibida = e.tipo === 'mensagem_proibida';
                                                const isSensivel = e.tipo === 'mensagem_sensivel';
                                                let corLinha = isProibida ? 'bg-red-50 dark:bg-red-900/30' : isSensivel ? 'bg-yellow-50 dark:bg-yellow-900/30' : '';
                                                const numAdv = e.dados.usuarioId && e.dados.grupoId ? (advertencias.find(a => a.usuarioId === e.dados.usuarioId && a.grupoId === e.dados.grupoId)?.count || 0) : 0;
                                                return (
                                                    <tr key={e.id} className={cn(tableRowClasses, corLinha)}>
                                                        <td className={tableCellClasses}>{new Date(e.dados.timestamp).toLocaleString()}</td>
                                                        <td className={tableCellClasses}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isProibida ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' : isSensivel ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>{e.tipo.replace(/_/g, ' ')}</span></td>
                                                        <td className={tableCellClasses}>{e.dados.usuario || 'N/A'}</td>
                                                        <td className={tableCellClasses}>{e.dados.grupo || 'N/A'}</td>
                                                        <td className={cn(tableCellClasses, "break-words max-w-xs sm:max-w-sm md:max-w-md")}>{e.dados.mensagem || e.dados.motivo || `Contagem: ${e.dados.contagemAtual}`}</td>
                                                        <td className={cn(tableCellClasses, "text-center space-x-1")}>
                                                            {(isProibida || isSensivel) && e.dados.mensagem && <Button variant="outline" size="sm" onClick={() => adicionarAdvertencia(e)} title={`Advertir (${numAdv}/${config.limite})`} className="text-xs dark:border-gray-600 dark:hover:bg-gray-700"><AlertTriangle className={`mr-1 h-3 w-3 ${isProibida ? 'text-red-500' : 'text-yellow-500'}`} />Advertir</Button>}
                                                            {e.dados.mensagem && <Button variant="ghost" size="sm" onClick={() => handleDenuncia(e)} title="Revisar mensagem" className="text-xs dark:hover:bg-gray-700"><Flag className="mr-1 h-3 w-3 text-blue-500"/>Revisar</Button>}
                                                        </td>
                                                    </tr>);
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {loading.global && <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Carregando histórico...</p>}
                                {eventosFiltrados.length === 0 && !loading.global && <p className="mt-4 text-center text-gray-500 dark:text-gray-400">Nenhum evento encontrado para o filtro atual.</p>}
                            </CardContent>
                        </Card>
                    </>
                );
            // Outros cases (relatorios, banidos, registro) permanecem similares, usando loading.global
            case 'relatorios':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Relatórios</h2>
                        <Card className={cardClasses}>
                            <CardHeader><CardTitle className="flex items-center text-lg"><FileText className="mr-2 h-5 w-5 text-teal-500"/>Relatório Semanal</CardTitle><CardDescription className={descriptionClasses}>Dados consolidados da moderação.</CardDescription></CardHeader>
                            <CardContent>
                                <Button onClick={gerarRelatorioSemanal} className="mb-4 text-sm bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700 text-white" disabled={loading.global}><FileText className="mr-1 h-4 w-4" />Gerar Relatório</Button>
                                {relatorios.length > 0 ? (<div className="overflow-x-auto max-h-[60vh] rounded-md border dark:border-gray-700"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700/80 sticky top-0"><tr><th className={tableHeaderClasses}>Data</th><th className={tableHeaderClasses}>Grupo</th><th className={tableHeaderClasses}>Usuário</th><th className={tableHeaderClasses}>Tipo Ofensa</th><th className={tableHeaderClasses}>Mensagem</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{relatorios.map((r, i) => (<tr key={i} className={tableRowClasses}><td className={tableCellClasses}>{new Date(r.data).toLocaleString()}</td><td className={tableCellClasses}>{r.grupoId}</td><td className={tableCellClasses}>{r.usuarioId}</td><td className={tableCellClasses}>{r.tipoOfensa}</td><td className={cn(tableCellClasses,"break-words max-w-xs")}>{r.mensagem}</td></tr>))}</tbody></table></div>)
                                : (<p className="mt-4 text-gray-500 dark:text-gray-400">{loading.global ? 'Gerando...' : 'Nenhum relatório ou clique em "Gerar Relatório".'}</p>)}
                            </CardContent>
                        </Card>
                    </>
                );
            case 'banidos':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Usuários Banidos</h2>
                        <Card className={cardClasses}>
                            <CardHeader><CardTitle className="flex items-center text-lg"><UserX className="mr-2 h-5 w-5 text-pink-500"/>Gerenciar Banimentos</CardTitle><CardDescription className={descriptionClasses}>Lista de usuários banidos.</CardDescription></CardHeader>
                            <CardContent>
                                <div className="mb-4"><h4 className={cn(labelClasses, "mb-2 text-base")}>Banir Usuário</h4><div className="flex gap-2"><Input type="text" placeholder="ID do usuário a banir" className={inputClasses} id="banirUsuarioInput" onKeyDown={(e) => {if (e.key === 'Enter') { const t = e.target as HTMLInputElement; if(t.value.trim()){banirUsuario(t.value.trim()); t.value='';}}}}/><Button onClick={() => {const i = document.getElementById('banirUsuarioInput') as HTMLInputElement; if(i && i.value.trim()){banirUsuario(i.value.trim());i.value='';}else{showError('ID do usuário é obrigatório.')}}} className="bg-pink-500 hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-700 text-white text-sm" disabled={loading.global}><Ban className="mr-1 h-4 w-4"/>Banir</Button></div></div>
                                {usuariosBanidos.length > 0 ? (<ul className="space-y-1 max-h-60 overflow-y-auto pr-1">{usuariosBanidos.map((uid) => (<li key={uid} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/80 p-2 rounded text-sm">{uid}<Button onClick={() => removerBanimento(uid)} variant="outline" size="sm" className="text-xs dark:border-gray-600 dark:hover:bg-gray-700"><UserX className="mr-1 h-3 w-3"/>Remover Ban</Button></li>))}</ul>)
                                : (<p className="text-gray-500 dark:text-gray-400">{loading.global ? 'Carregando...' : 'Nenhum usuário banido.'}</p>)}
                            </CardContent>
                        </Card>
                    </>
                );
            case 'registro':
                return (
                    <>
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">Revisão de Mensagens</h2>
                        <Card className={cardClasses}>
                            <CardHeader><CardTitle className="flex items-center text-lg"><MessageCircle className="mr-2 h-5 w-5 text-cyan-500"/>Mensagens para Revisão</CardTitle><CardDescription className={descriptionClasses}>Analise mensagens marcadas.</CardDescription></CardHeader>
                            <CardContent>
                                {eventoParaRevisar ? (<div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-800/50 border border-yellow-400 dark:border-yellow-700 rounded-md"><p className="text-sm mb-1 dark:text-gray-200"><strong>Usuário:</strong> {eventoParaRevisar.dados.usuario}</p><p className="text-sm mb-1 dark:text-gray-200"><strong>Grupo:</strong> {eventoParaRevisar.dados.grupo}</p><p className="text-sm mb-2 dark:text-gray-200"><strong>Mensagem:</strong> "{eventoParaRevisar.dados.mensagem}"</p><p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Timestamp: {new Date(eventoParaRevisar.dados.timestamp).toLocaleString()}</p><div className="mt-2 flex flex-col sm:flex-row gap-2"><Button onClick={aprovarRevisao} className="text-sm bg-green-500 hover:bg-green-600 text-white flex-1" disabled={loading.global}><CheckIcon className="mr-1 h-4 w-4"/>Advertir</Button><Button onClick={reprovarRevisao} className="text-sm bg-red-500 hover:bg-red-600 text-white flex-1" disabled={loading.global}><XCircle className="mr-1 h-4 w-4"/>Ignorar</Button></div>{verificarTempoDenuncia(eventoParaRevisar.dados.timestamp) > 24 && (<Alert variant="default" className="mt-3 border-yellow-500 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/50 dark:border-yellow-700"><AlertTriangle className="h-4 w-4"/><AlertTitle>Atenção</AlertTitle><AlertDescription className="text-xs">Denúncia com mais de 24 horas.</AlertDescription></Alert>)}</div>)
                                : (<p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhuma mensagem para revisar.</p>)}
                                <div className="mt-6 pt-6 border-t dark:border-gray-700"><h4 className={cn(labelClasses, "mb-2 text-base")}>Denunciar Manualmente (Simulação)</h4><Textarea placeholder="Cole a mensagem para simular denúncia..." value={mensagemRevisao} onChange={(e) => setMensagemRevisao(e.target.value)} className={cn(inputClasses, "mb-2")} rows={3}/><Button onClick={() => {if(mensagemRevisao.trim()){ const evSim: Evento = {id: crypto.randomUUID(), tipo: 'denuncia_manual_simulada', dados: {timestamp: new Date().toISOString(), usuario: prompt("ID do Usuário (simulado):")||'UsuárioSim', grupo: prompt("ID do Grupo (simulado):")||'GrupoSim', mensagem: mensagemRevisao}}; handleDenuncia(evSim); setMensagemRevisao('');}else{showError('Insira a mensagem.');}}} className="text-sm bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700 text-white" disabled={loading.global}><Flag className="mr-1 h-4 w-4"/>Simular Denúncia</Button></div>
                                {loading.global && !eventoParaRevisar && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Carregando...</p>}
                            </CardContent>
                        </Card>
                    </>
                );
            default:
                return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Seção não encontrada.</div>;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <aside className={cn(
                "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg transition-transform duration-300 ease-in-out",
                isMobile ? "fixed inset-y-0 left-0 z-30 w-64 transform -translate-x-full" : "sticky top-0 h-screen w-64",
                // Adicionar classe para mostrar sidebar em mobile quando um estado for ativado
                // Ex: isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Moderação</h1>
                    <Button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} variant="ghost" size="icon" className="transition-all duration-300 transform hover:scale-110 hover:text-blue-500 dark:hover:text-blue-300">
                        {theme === 'light' ? <Moon className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
                    </Button>
                </div>
                <nav className="flex-grow p-2 space-y-1 overflow-y-auto">
                    {navItems.map(item => (
                        <Button
                            key={item.value}
                            variant={activeSection === item.value ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start text-sm font-medium py-2.5 px-3 rounded-md",
                                "transition-all duration-200 ease-in-out transform hover:translate-x-1",
                                activeSection === item.value
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 shadow-sm"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                            )}
                            onClick={() => setActiveSection(item.value)}
                        >
                            {item.icon}
                            {item.label}
                        </Button>
                    ))}
                </nav>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                     <Button variant="outline" className="w-full text-sm border-red-500 text-red-500 hover:bg-red-500 hover:text-white dark:border-red-600 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white">
                        <LogOut className="mr-2 h-4 w-4"/> Sair (Simulação)
                    </Button>
                </div>
            </aside>

            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                {isMobile && (
                    <Button
                        onClick={() => {
                            const sidebar = document.querySelector('aside');
                            sidebar?.classList.toggle('-translate-x-full'); // Exemplo simples de toggle
                        }}
                        className="md:hidden mb-4 fixed top-4 right-4 z-40 bg-gray-800 text-white p-2 rounded-md"
                        size="icon"
                        variant="outline"
                    >
                        <List className="h-5 w-5" />
                    </Button>
                )}

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4">
                            <Alert variant="destructive" className="shadow-md">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Erro</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setError(null)}><XCircle className="h-3 w-3"/></Button>
                            </Alert>
                        </motion.div>
                    )}
                    {successMessage && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4">
                            <Alert variant="default" className="bg-green-100 border-green-400 text-green-700 dark:bg-green-800/50 dark:border-green-600 dark:text-green-300 shadow-md">
                                <CheckCircle className="h-4 w-4" />
                                <AlertTitle>Sucesso</AlertTitle>
                                <AlertDescription>{successMessage}</AlertDescription>
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setSuccessMessage(null)}><XCircle className="h-3 w-3"/></Button>
                            </Alert>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode='wait'>
                    <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderSection()}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};

export default PainelModeracao;
