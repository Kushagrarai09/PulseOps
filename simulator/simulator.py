import json, os, random, time
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

BROKER_URL=os.getenv("MQTT_URL","mqtt://localhost:1883")
BROKER_HOST=BROKER_URL.replace("mqtt://","").split(":")[0]
BROKER_PORT=int(BROKER_URL.rsplit(":",1)[1]) if ":" in BROKER_URL else 1883
INTERVAL=float(os.getenv("PUBLISH_INTERVAL","2"))
DEVICES=[
 {"id":"press-001","base_temp":58,"base_pressure":5.2,"base_vibration":2.0},
 {"id":"motor-002","base_temp":46,"base_pressure":3.8,"base_vibration":1.3},
 {"id":"pump-003","base_temp":52,"base_pressure":6.1,"base_vibration":2.5},
]
def on_connect(client,userdata,flags,reason_code,properties):
 print(f"Connected to MQTT broker with result: {reason_code}")
client=mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,client_id="iiot-sensor-simulator")
client.on_connect=on_connect
while True:
 try:
  client.connect(BROKER_HOST,BROKER_PORT,60); break
 except OSError as exc:
  print(f"Waiting for MQTT broker: {exc}"); time.sleep(3)
client.loop_start()
while True:
 for device in DEVICES:
  spike=random.random()<0.035
  payload={
   "temperature":round(device["base_temp"]+random.uniform(-3,4)+(28 if spike else 0),2),
   "pressure":round(device["base_pressure"]+random.uniform(-0.4,0.4),2),
   "vibration":round(device["base_vibration"]+random.uniform(-0.25,0.35),2),
   "voltage":round(230+random.uniform(-4,4),2),
   "current":round(3.2+random.uniform(-0.5,0.5),2),
   "machineStatus":random.choices(["running","idle","stopped"],[0.88,0.08,0.04])[0],
   "timestamp":datetime.now(timezone.utc).isoformat()
  }
  topic=f"iiot/devices/{device['id']}/telemetry"
  info=client.publish(topic,json.dumps(payload),qos=1)
  print(f"{topic} -> {payload} (rc={info.rc})")
 time.sleep(INTERVAL)
