import { Sensor, StatusMedicao } from '../types';

/**
 * Classifica uma medição seguindo a mesma regra do backend (MedicaoService):
 *  - CRÍTICO: valor fora dos limites permitidos pelo sensor
 *  - ALERTA: dentro da faixa, porém na zona de 20% de proximidade dos limites
 *  - NORMAL: operação estável e centralizada
 *
 * Quando o sensor não define limites, cai no comportamento antigo baseado
 * em faixas fixas (0-80 normal, 80-100 alerta, acima crítico).
 */
export function calcularStatus(valor: number, sensor?: Sensor): StatusMedicao {
    const min = sensor?.limiteMinimo;
    const max = sensor?.limiteMaximo;

    if (min === undefined || max === undefined) {
        if (valor > 100) return "critico";
        if (valor > 80) return "alerta";
        return "normal";
    }

    // 1. CRÍTICO: fora das faixas permitidas pelo dispositivo
    if (valor < min || valor > max) return "critico";

    // 2. ALERTA: dentro da faixa, porém próximo do limite (zona de 20%)
    const amplitude = max - min;
    const margemTolerancia = amplitude * 0.2;
    if (valor >= (max - margemTolerancia) || valor <= (min + margemTolerancia)) {
        return "alerta";
    }

    // 3. NORMAL: operação estável e centralizada
    return "normal";
}
