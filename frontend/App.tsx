import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Platform, Alert, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

import { Sensor, Medicao, StatusMedicao } from './src/types';
import { calcularStatus } from './src/utils/status';

// Configuração da API
const IP_BACKEND = 'localhost'; // Troque para o seu IP físico se usar no celular
const API_URL_SENSORES = `http://${IP_BACKEND}:8080/api/sensores`;
const API_URL_MEDICOES = `http://${IP_BACKEND}:8080/api/medicoes`;

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const SENSORES_MOCK: Sensor[] = [
  { id: 1, nome: "Termômetro Caldeira", tipo: "Temperatura", unidade: "°C", limiteMinimo: 0, limiteMaximo: 100 },
  { id: 2, nome: "Nó LoRa V4 - Km 42", tipo: "Vegetação", unidade: "cm", limiteMinimo: 10, limiteMaximo: 80 },
];

const TEMAS = {
  light: {
    background: '#F0F2F5', card: '#FFFFFF', textoPrincipal: '#1A1A1A',
    textoSecundario: '#757575', primaria: '#3949AB', divisor: '#EEEEEE',
    status: { normalBg: '#E8F5E9', normalText: '#2E7D32', alertaBg: '#FFFDE7', alertaText: '#F9A825', criticoBg: '#FFEBEE', criticoText: '#C62828' }
  },
  dark: {
    background: '#121212', card: '#1E1E1E', textoPrincipal: '#FFFFFF',
    textoSecundario: '#A0A0A0', primaria: '#5C6BC0', divisor: '#333333',
    status: { normalBg: '#1B5E20', normalText: '#A5D6A7', alertaBg: '#F57F17', alertaText: '#FFE082', criticoBg: '#B71C1C', criticoText: '#EF9A9A' }
  }
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isModoAPI, setIsModoAPI] = useState(false);

  // Estados de Sensores
  const [sensores, setSensores] = useState<Sensor[]>(SENSORES_MOCK);
  const [indiceSensorAtual, setIndiceSensorAtual] = useState(0);

  // Estados do Modal (Novo Sensor)
  const [modalVisivel, setModalVisivel] = useState(false);
  const [novoSensorForm, setNovoSensorForm] = useState({ nome: '', tipo: '', unidade: '', min: '0', max: '100' });

  const [medicao, setMedicao] = useState<Medicao>({
    id: 1,
    sensor: SENSORES_MOCK[0],
    valor: 0,
    data: new Date(),
    status: "normal"
  });

  const temaAtivo = isDarkMode ? TEMAS.dark : TEMAS.light;
  const sensorSelecionado = sensores.length > 0 ? sensores[indiceSensorAtual] : SENSORES_MOCK[0];

  // ================= EFEITO: CARREGAR SENSORES =================
  useEffect(() => {
    const carregarSensoresDaAPI = async () => {
      try {
        const response = await fetch(API_URL_SENSORES);
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setSensores(data);
            setIndiceSensorAtual(0);
          }
        }
      } catch (error) {
        console.log("Aviso: Backend offline. Usando mock.");
      }
    };

    if (isModoAPI) carregarSensoresDaAPI();
    else {
      setSensores(SENSORES_MOCK);
      setIndiceSensorAtual(0);
    }
  }, [isModoAPI]);

  // ================= AÇÕES =================
  const alternarSensor = () => {
    if (sensores.length === 0) return;
    setIndiceSensorAtual((prev) => (prev + 1) % sensores.length);
  };

  const salvarNovoSensor = async () => {
    if (!novoSensorForm.nome || !novoSensorForm.tipo) {
      Alert.alert("Erro", "Preencha pelo menos Nome e Tipo.");
      return;
    }

    const payload = {
      nome: novoSensorForm.nome,
      tipo: novoSensorForm.tipo,
      unidade: novoSensorForm.unidade,
      limiteMinimo: parseFloat(novoSensorForm.min),
      limiteMaximo: parseFloat(novoSensorForm.max),
      ativo: true
    };

    if (isModoAPI) {
      try {
        const response = await fetch(API_URL_SENSORES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const sensorSalvo = await response.json();
          setSensores([...sensores, sensorSalvo]);
          setIndiceSensorAtual(sensores.length);
          Alert.alert("Sucesso", "Sensor cadastrado no Banco H2!");
        }
      } catch (error) {
        Alert.alert("Erro", "Falha ao conectar com Spring Boot.");
      }
    } else {
      const novoMock: Sensor = { ...payload, id: Date.now() } as any;
      setSensores([...sensores, novoMock]);
      setIndiceSensorAtual(sensores.length);
    }

    setModalVisivel(false);
    setNovoSensorForm({ nome: '', tipo: '', unidade: '', min: '0', max: '100' });
  };

  const realizarLeituraEEnviar = async () => {
    if (!sensorSelecionado) return;

    // Lógica para gerar um valor dinâmico baseado nos limites do sensor
    const min = sensorSelecionado.limiteMinimo !== undefined ? sensorSelecionado.limiteMinimo : 0;
    const max = sensorSelecionado.limiteMaximo !== undefined ? sensorSelecionado.limiteMaximo : 100;
    const amplitude = max > min ? max - min : 100;

    // Gera um número que varia de 10% abaixo do mínimo até 10% acima do máximo
    // Isso garante que testaremos estados Normal, Alerta e Crítico aleatoriamente
    const valorLido = min - (amplitude * 0.1) + Math.random() * (amplitude * 1.2);
    const valorNumerico = parseFloat(valorLido.toFixed(1));
    const dataAtual = new Date();

    if (!isModoAPI) {
      // MODO LOCAL
      setMedicao(prev => ({
        id: prev.id + 1,
        sensor: sensorSelecionado,
        valor: valorNumerico,
        data: dataAtual,
        status: calcularStatus(valorNumerico, sensorSelecionado)
      }));
    } else {
      // MODO API
      const payloadMedicao = {
        valor: valorNumerico,
        sensor: { id: sensorSelecionado.id }
      };

      try {
        const response = await fetch(API_URL_MEDICOES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadMedicao)
        });

        if (!response.ok) throw new Error("Erro no POST");
        const data = await response.json();

        setMedicao({
          id: data.id,
          sensor: data.sensor,
          valor: data.valor,
          data: new Date(data.data),
          status: data.status.toLowerCase() as StatusMedicao
        });
      } catch (error) {
        Alert.alert("Erro", "Não foi possível registrar a medição. Verifique se o backend está rodando.");
      }
    }
  };

  const getConfigStatus = (status: StatusMedicao): { bg: string; text: string; icon: IconName } => {
    switch (status) {
      case 'normal': return { bg: temaAtivo.status.normalBg, text: temaAtivo.status.normalText, icon: 'check-circle' };
      case 'alerta': return { bg: temaAtivo.status.alertaBg, text: temaAtivo.status.alertaText, icon: 'alert' };
      case 'critico': return { bg: temaAtivo.status.criticoBg, text: temaAtivo.status.criticoText, icon: 'fire' };
      default: return { bg: temaAtivo.divisor, text: temaAtivo.textoPrincipal, icon: 'help-circle' };
    }
  };

  const statusConfig = getConfigStatus(medicao.status);
  const formatarData = (data: Date) => `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR')}`;

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: temaAtivo.background }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={temaAtivo.background} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: temaAtivo.card, borderBottomColor: temaAtivo.divisor }]}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="broadcast" size={28} color={temaAtivo.primaria} />
            <Text style={[styles.tituloSistema, { color: temaAtivo.textoPrincipal }]}>IoT Monitor</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setIsModoAPI(!isModoAPI)} style={[styles.apiToggle, { backgroundColor: isModoAPI ? '#4CAF50' : '#9E9E9E' }]}>
              <MaterialCommunityIcons name={isModoAPI ? "cloud-check" : "cloud-off-outline"} size={16} color="#FFF" />
              <Text style={styles.apiToggleText}>{isModoAPI ? "API" : "Local"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={styles.themeToggle}>
              <MaterialCommunityIcons name={isDarkMode ? "weather-night" : "weather-sunny"} size={24} color={temaAtivo.textoPrincipal} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>

          {/* Controle de Alternância e Criação de Sensores */}
          <View style={styles.sensorSelector}>
            <Text style={[styles.selectorTitle, { color: temaAtivo.textoSecundario }]}>Selecione ou Crie um Sensor:</Text>
            <View style={styles.selectorActions}>
              <TouchableOpacity style={[styles.selectorButton, { backgroundColor: temaAtivo.card, borderColor: temaAtivo.primaria }]} onPress={alternarSensor}>
                <Ionicons name="swap-horizontal" size={20} color={temaAtivo.primaria} />
                <Text style={[styles.selectorButtonText, { color: temaAtivo.primaria }]}>{sensorSelecionado?.nome || "Sem Sensor"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.addButton, { backgroundColor: temaAtivo.primaria }]} onPress={() => setModalVisivel(true)}>
                <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Card Principal */}
          <View style={[styles.card, { backgroundColor: temaAtivo.card }]}>
            <View style={[styles.modoBadge, { backgroundColor: isModoAPI ? '#E8F5E9' : '#EEEEEE' }]}>
              <Text style={{ color: isModoAPI ? '#2E7D32' : '#757575', fontSize: 12, fontWeight: 'bold' }}>
                {isModoAPI ? "DADOS SPRING BOOT" : "SIMULAÇÃO LOCAL"}
              </Text>
            </View>

            <View style={styles.cardHeader}>
              <View style={styles.badgeTipo}>
                <Text style={styles.badgeTipoText}>{medicao.sensor?.tipo?.toUpperCase() || 'N/A'}</Text>
              </View>
              <Text style={[styles.nomeSensor, { color: temaAtivo.textoPrincipal }]}>{medicao.sensor?.nome || 'N/A'}</Text>
              <Text style={[styles.dataText, { color: temaAtivo.textoSecundario }]}>
                Última leitura: {formatarData(medicao.data)}
              </Text>
            </View>

            <View style={[styles.divisor, { backgroundColor: temaAtivo.divisor }]} />

            {/* Valor da Medição (Voltou o layout de número gigante) */}
            <Text style={[styles.instrucaoTexto, { color: temaAtivo.textoSecundario }]}>Medição Captada:</Text>
            <View style={styles.valorContainer}>
              <Text style={[styles.valorDestaque, { color: temaAtivo.primaria }]}>{medicao.valor.toFixed(1)}</Text>
              <Text style={[styles.unidade, { color: temaAtivo.primaria }]}>{medicao.sensor?.unidade || ''}</Text>
            </View>

            <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
              <MaterialCommunityIcons name={statusConfig.icon} size={18} color={statusConfig.text} />
              <Text style={[styles.badgeTexto, { color: statusConfig.text }]}>
                {medicao.status.toUpperCase()}
              </Text>
            </View>

            <Text style={[styles.idText, { color: temaAtivo.textoSecundario }]}>Reg. ID: #{medicao.id} | Sensor ID: {medicao.sensor?.id || 0}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.botao, { backgroundColor: temaAtivo.primaria }]} onPress={realizarLeituraEEnviar} activeOpacity={0.8}>
            <MaterialCommunityIcons name="radar" size={24} color="#FFF" style={styles.iconBotao} />
            <Text style={styles.botaoTexto}>
              {isModoAPI ? "LER SENSOR & ENVIAR" : "LER SENSOR (LOCAL)"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modal de Criação de Sensor (Mantido intacto) */}
        <Modal visible={modalVisivel} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: temaAtivo.card }]}>
              <Text style={[styles.modalTitle, { color: temaAtivo.textoPrincipal }]}>Novo Sensor</Text>

              <TextInput style={[styles.modalInput, { color: temaAtivo.textoPrincipal, borderColor: temaAtivo.divisor }]} placeholder="Nome (ex: Sensor Solo)" placeholderTextColor="#999" value={novoSensorForm.nome} onChangeText={(text) => setNovoSensorForm({...novoSensorForm, nome: text})} />
              <TextInput style={[styles.modalInput, { color: temaAtivo.textoPrincipal, borderColor: temaAtivo.divisor }]} placeholder="Tipo (ex: Umidade)" placeholderTextColor="#999" value={novoSensorForm.tipo} onChangeText={(text) => setNovoSensorForm({...novoSensorForm, tipo: text})} />
              <TextInput style={[styles.modalInput, { color: temaAtivo.textoPrincipal, borderColor: temaAtivo.divisor }]} placeholder="Unidade (ex: %)" placeholderTextColor="#999" value={novoSensorForm.unidade} onChangeText={(text) => setNovoSensorForm({...novoSensorForm, unidade: text})} />
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <TextInput style={[styles.modalInput, { flex: 0.48, color: temaAtivo.textoPrincipal, borderColor: temaAtivo.divisor }]} placeholder="Min (0)" keyboardType="numeric" placeholderTextColor="#999" value={novoSensorForm.min} onChangeText={(text) => setNovoSensorForm({...novoSensorForm, min: text})} />
                <TextInput style={[styles.modalInput, { flex: 0.48, color: temaAtivo.textoPrincipal, borderColor: temaAtivo.divisor }]} placeholder="Max (100)" keyboardType="numeric" placeholderTextColor="#999" value={novoSensorForm.max} onChangeText={(text) => setNovoSensorForm({...novoSensorForm, max: text})} />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#757575' }]} onPress={() => setModalVisivel(false)}>
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: temaAtivo.primaria }]} onPress={salvarNovoSensor}>
                  <Text style={styles.modalBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  tituloSistema: { fontSize: 20, fontWeight: '700', marginLeft: 10, letterSpacing: 0.5 },
  apiToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 15 },
  apiToggleText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  themeToggle: { padding: 8, borderRadius: 20 },

  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  sensorSelector: { marginBottom: 20, alignItems: 'center' },
  selectorTitle: { fontSize: 14, marginBottom: 8 },
  selectorActions: { flexDirection: 'row', alignItems: 'center' },
  selectorButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginRight: 10 },
  selectorButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  addButton: { padding: 10, borderRadius: 20, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2 },

  card: { borderRadius: 24, padding: 30, paddingTop: 40, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8, position: 'relative' },
  modoBadge: { position: 'absolute', top: -12, paddingHorizontal: 15, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FFF' },
  cardHeader: { alignItems: 'center', marginBottom: 15 },
  badgeTipo: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  badgeTipoText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  nomeSensor: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 5 },
  dataText: { fontSize: 12, fontStyle: 'italic' },
  divisor: { width: '100%', height: 1, marginBottom: 25 },

  instrucaoTexto: { fontSize: 12, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  valorContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  valorDestaque: { fontSize: 80, fontWeight: 'bold', lineHeight: 80 },
  unidade: { fontSize: 24, fontWeight: '600', marginTop: 10, marginLeft: 2 },

  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30, marginBottom: 15 },
  badgeTexto: { fontWeight: '700', fontSize: 14, marginLeft: 8, letterSpacing: 1 },
  idText: { fontSize: 12, fontStyle: 'italic' },

  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 20 : 30 },
  botao: { flexDirection: 'row', paddingVertical: 18, borderRadius: 16, width: '100%', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  iconBotao: { marginRight: 10 },
  botaoTexto: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  // Estilos do Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 15, marginBottom: 15, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, padding: 15, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});