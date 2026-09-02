# Nautium NMEA 2000 Boat Simulator

Simula un yate completo en un bus NMEA 2000 usando un ESP32 + módulo CAN.
Ideal para probar la integración con gateways (iKommunicate, YDWG-02) sin necesidad de un barco real.

## Qué simula

- 2 motores principales (Port / Starboard) con RPM, temperatura, presión de aceite, horas
- 2 generadores con voltaje, carga, temperatura, horas
- 2 bancos de baterías con SOC, voltaje, corriente, temperatura
- 3 tanques (diesel principal, diesel generador, agua dulce)

## Hardware necesario

| Componente | Ejemplo | Precio aprox |
|---|---|---|
| ESP32 DevKit | ESP32 WROOM-32 | $150 MXN / $8 USD |
| Módulo CAN | MCP2515 + TJA1050 | $100 MXN / $5 USD |
| Cables dupont | Macho-hembra | $30 MXN / $2 USD |

### Opcional (para banco de pruebas completo)

| Componente | Ejemplo | Precio aprox |
|---|---|---|
| Kit NMEA 2000 | Garmin starter kit (cables + terminadores) | $50 USD |
| Gateway | Digital Yacht iKommunicate | $300 USD |

## Cableado

```
ESP32           MCP2515/CAN Module
─────           ──────────────────
GPIO 4    ───→  CAN TX (CTX)
GPIO 5    ───→  CAN RX (CRX)
3.3V      ───→  VCC
GND       ───→  GND

CAN Module      NMEA 2000 Backbone
──────────      ──────────────────
CAN_H     ───→  Pin 5 (azul)
CAN_L     ───→  Pin 4 (blanco)
GND       ───→  Pin 3 (shield/tierra)
```

## Instalación del firmware

### 1. Instalar Arduino IDE

Descarga de: https://www.arduino.cc/en/software

### 2. Agregar soporte ESP32

1. Abre Arduino IDE
2. Ve a **File → Preferences**
3. En "Additional Board Manager URLs" agrega:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Ve a **Tools → Board → Boards Manager**
5. Busca "esp32" e instala **esp32 by Espressif Systems**

### 3. Instalar librerías

Ve a **Sketch → Include Library → Manage Libraries** e instala:

- **NMEA2000** por Timo Lappalainen
- **NMEA2000_esp32** por Timo Lappalainen

### 4. Configurar la placa

1. Ve a **Tools → Board** y selecciona **ESP32 Dev Module**
2. **Tools → Port** → selecciona el puerto COM del ESP32
3. **Tools → Upload Speed** → 115200

### 5. Subir el firmware

1. Abre `esp32-nmea-simulator.ino`
2. Click en **Upload** (flecha →)
3. Espera a que compile y suba
4. Abre **Tools → Serial Monitor** (115200 baud)

## Uso

Una vez subido, el ESP32 empieza a transmitir datos NMEA 2000 automáticamente.

### Comandos por Serial Monitor

| Comando | Acción |
|---|---|
| `E1` | Encender/apagar motor Port |
| `E2` | Encender/apagar motor Starboard |
| `G1` | Encender/apagar generador 1 |
| `G2` | Encender/apagar generador 2 |
| `T+` | Subir throttle +10% |
| `T-` | Bajar throttle -10% |
| `R`  | Reset a valores por defecto |

### Lo que verás en Serial Monitor

```
─────────────────────────────────────────────
  PORT  ON   RPM:1550  Temp:82.5°C  Oil:474kPa  Hrs:2847.3  Thr:50%
  STBD  ON   RPM:1550  Temp:81.2°C  Oil:468kPa  Hrs:2831.1  Thr:50%
  GEN1  ON   V:226     Load:47%     Temp:73.6°C  Hrs:1205.2
  GEN2  OFF  V:0       Load:0%      Temp:25.0°C  Hrs:890.0
  BAT1  SOC:87.3%  V:27.1  A:+18.4  CHARGING
  BAT2  SOC:91.8%  V:26.5  A:-7.2   DISCHARGING
  DIESEL: 52.3%  GEN DIESEL: 12.0%  WATER: 59.9%
─────────────────────────────────────────────
```

## Diagrama del banco de pruebas

```
                    NMEA 2000 Bus
  [Terminador]──────────────────────────[Terminador]
                  │                │
              [T-conn]         [T-conn]
                  │                │
           [ESP32 + CAN]    [iKommunicate]
           (simulador)       (gateway)
                                │
                            [Ethernet]
                                │
                        [Laptop/Tablet]
                         Nautium Browser
```

## PGNs transmitidos

| PGN | Descripción | Datos |
|---|---|---|
| 127488 | Engine Rapid Update | RPM |
| 127489 | Engine Dynamic | Temperatura, presión aceite, horas |
| 127505 | Fluid Level | Nivel de tanques |
| 127508 | Battery Status | Voltaje, corriente, SOC, temperatura |

## Solución de problemas

- **No compila**: Verifica que instalaste las librerías NMEA2000 y NMEA2000_esp32
- **No transmite**: Revisa el cableado CAN_TX (GPIO 4) y CAN_RX (GPIO 5)
- **Gateway no recibe**: Asegura que CAN_H y CAN_L están conectados correctamente y hay terminadores en ambos extremos del backbone
- **Serial Monitor vacío**: Cambia el baud rate a 115200
