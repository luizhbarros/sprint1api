# FieldTech — Monitoramento de Vegetação

Sistema de **monitoramento ambiental de vegetação** baseado em sensores IoT. O projeto coleta medições de sensores de campo (temperatura, umidade, crescimento de vegetação, etc.), persiste os dados em um backend Spring Boot e os exibe em um aplicativo mobile. Cada medição é classificada automaticamente em três níveis de severidade:

- 🟢 **NORMAL** — operação estável, valor dentro da faixa segura
- 🟡 **ALERTA** — valor dentro dos limites, porém próximo do limite (zona de 20% de tolerância)
- 🔴 **CRÍTICO** — valor fora dos limites permitidos pelo sensor

---

## Integrantes

| Nome | RM |
|------|-----|
| Gabriel Assis | 562280 |
| Rafael Lucca Bazan | 561920 |
| Nicholas Maretto | 561725 |
| Luiz Barros | 561311 |
| Fernando Castanha | 562226 |

---

## Repositórios

Este repositório é um **monorepo** que contém o backend e o frontend juntos:

- **Projeto (backend + frontend):** https://github.com/luizhbarros/sprint1api

Repositórios separados utilizados na Sprint 3:

- **Backend:** https://github.com/luizhbarros/sprint3back
- **Frontend:** https://github.com/luizhbarros/sprint3front

---

## Stack

- **Backend:** Spring Boot 4 (Java 17), Spring Data JPA, banco H2 em arquivo
- **Frontend:** React Native + Expo + TypeScript
- **Comunicação:** API REST (JSON) sobre HTTP

---

## Estrutura do projeto

```
sprint1api/
├── backend/                         # API REST em Spring Boot
│   └── src/main/java/com/fiap/monitoramento_vegetacao/
│       ├── controller/              # Endpoints REST (Sensor, Medicao)
│       ├── service/                 # Regras de negócio e cálculo de status
│       ├── repository/              # Acesso a dados (Spring Data JPA)
│       ├── model/                   # Entidades: Sensor, Medicao, StatusMedicao
│       └── dto/                     # MedicaoResponseDTO
│
└── frontend/                        # App mobile em Expo / React Native
    ├── App.tsx                      # Tela principal (screen) + consumo da API
    └── src/
        ├── types/                   # Tipos TypeScript (Sensor, Medicao, StatusMedicao)
        └── utils/                   # status.ts — classificação NORMAL/ALERTA/CRÍTICO
```

Observação sobre a estrutura `src/`:

- **types** — definições de tipos do domínio (`Sensor`, `Medicao`, `StatusMedicao`), em `src/types/index.ts`.
- **services** — nesta versão, o consumo da API (chamadas `fetch` para `/api/sensores` e `/api/medicoes`) está centralizado dentro de `App.tsx`. Não há uma pasta `services/` separada.
- **screens** — a tela única do app é o próprio `App.tsx`, que concentra a interface. Não há uma pasta `screens/` separada.
- **utils** — regras auxiliares, incluindo `status.ts` com o cálculo de status no cliente.

---

## Tipos de domínio

### Sensor

Representa um dispositivo de coleta instalado em campo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | Identificador único |
| `nome` | string | Nome do sensor (ex: "Nó LoRa V4 - Km 42") |
| `tipo` | string | Grandeza medida (ex: "Vegetação", "Temperatura") |
| `unidade` | string | Unidade de medida (ex: "cm", "°C") |
| `limiteMinimo` | number? | Limite inferior aceitável |
| `limiteMaximo` | number? | Limite superior aceitável |
| `ativo` | boolean? | Se o sensor está em operação |

### Medicao

Representa uma leitura individual feita por um sensor.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | Identificador único da medição |
| `sensor` | Sensor | Sensor que originou a leitura |
| `valor` | number | Valor medido |
| `data` | Date | Momento da coleta |
| `status` | StatusMedicao | `"normal"` \| `"alerta"` \| `"critico"` |

---

## Como o status é calculado

A classificação de uma medição em **NORMAL / ALERTA / CRÍTICO** segue a mesma regra nos dois lados do sistema, baseada nos limites (`limiteMinimo` e `limiteMaximo`) definidos para cada sensor:

1. **CRÍTICO** — o valor está **fora** da faixa permitida (`valor < limiteMinimo` ou `valor > limiteMaximo`).
2. **ALERTA** — o valor está dentro da faixa, porém **próximo de um dos limites**. A "zona de alerta" corresponde aos 20% de cada extremidade da faixa (margem = amplitude × 0.2).
3. **NORMAL** — o valor está na parte central da faixa, longe dos limites.

Exemplo para um sensor com limites 10 e 80 (amplitude 70, margem 14 → zona de alerta ≤ 24 ou ≥ 66):

| Valor | Status |
|-------|--------|
| 45 | NORMAL |
| 70 | ALERTA |
| 95 | CRÍTICO |

### Backend — `MedicaoService.calcularStatus`

É a **fonte da verdade**. O status é calculado no servidor no momento em que a medição é devolvida pela API (ele não fica gravado na tabela — é derivado dos limites do sensor a cada consulta):

```java
public StatusMedicao calcularStatus(Double valor, Sensor sensor) {
    if (sensor.getLimiteMinimo() == null || sensor.getLimiteMaximo() == null) {
        return StatusMedicao.NORMAL;
    }
    double min = sensor.getLimiteMinimo();
    double max = sensor.getLimiteMaximo();

    // 1. CRÍTICO: fora das faixas permitidas
    if (valor < min || valor > max) return StatusMedicao.CRITICO;

    // 2. ALERTA: dentro da faixa, porém na zona de 20% de proximidade
    double amplitude = max - min;
    double margemTolerancia = amplitude * 0.2;
    if (valor >= (max - margemTolerancia) || valor <= (min + margemTolerancia)) {
        return StatusMedicao.ALERTA;
    }

    // 3. NORMAL
    return StatusMedicao.NORMAL;
}
```

### Frontend — `calcularStatus` (`src/utils/status.ts`)

O app replica a mesma regra para o modo de **simulação local** (quando não está consumindo a API). No modo API, o status exibido vem pronto do backend.

```ts
export function calcularStatus(valor: number, sensor?: Sensor): StatusMedicao {
    const min = sensor?.limiteMinimo;
    const max = sensor?.limiteMaximo;

    if (min === undefined || max === undefined) {
        if (valor > 100) return "critico";
        if (valor > 80) return "alerta";
        return "normal";
    }

    if (valor < min || valor > max) return "critico";       // CRÍTICO

    const amplitude = max - min;
    const margemTolerancia = amplitude * 0.2;
    if (valor >= (max - margemTolerancia) || valor <= (min + margemTolerancia)) {
        return "alerta";                                      // ALERTA
    }

    return "normal";                                          // NORMAL
}
```

---

## Como rodar

### Pré-requisitos

- Java 17+ (JDK)
- Node.js 18+ e npm
- Um emulador Android/iOS ou o app **Expo Go** no celular

### 1. Backend (Spring Boot)

```bash
cd backend
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`. O banco H2 é persistido em arquivo (`backend/data/vegetacao_db`), então os dados sobrevivem entre reinicializações. Console do H2 disponível em `http://localhost:8080/h2-console`.

> No Windows use `mvnw.cmd` no lugar de `./mvnw`.

#### Principais endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/sensores` | Lista todos os sensores |
| `POST` | `/api/sensores` | Cadastra um sensor |
| `GET` | `/api/medicoes` | Lista todas as medições (com status calculado) |
| `POST` | `/api/medicoes` | Registra uma nova medição |
| `GET` | `/api/medicoes/sensor/{id}` | Lista medições de um sensor |

### 2. Frontend (Expo / React Native)

```bash
cd frontend
npm install
npm start
```

Leia o QR Code com o Expo Go ou abra em um emulador.

> **Importante:** por padrão o app usa `localhost` para falar com o backend. Ao rodar em um **celular físico**, troque a constante `IP_BACKEND` em `App.tsx` pelo IP da máquina que roda o backend (ex: `192.168.0.10`).

---

## Comportamento esperado

- O app lista as medições vindas da API e exibe o status (NORMAL / ALERTA / CRÍTICO) de cada leitura.
- O botão de leitura gera uma coleta e a **persiste no backend** (modo API).
- Com o **backend parado**, o app exibe um erro na tela — não inventa uma lista falsa.
- O botão **API / Local** no topo alterna entre consumir o backend real e o modo de simulação local.
