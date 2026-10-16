import { events } from '../core/events';

export type Lang = 'en' | 'es';

/**
 * Flat translation dictionary. Keys are grouped by prefix:
 *   start.*  start screen     hud.*   heads-up display
 *   anat.*   anatomy labels   ctl.*   controls help
 */
const DICT: Record<string, { en: string; es: string }> = {
  'app.title': { en: 'IC-PC Aneurysm Clipping', es: 'Clipaje de aneurisma IC-PC' },
  'app.subtitle': {
    en: 'Right pterional · transsylvian approach — microsurgical simulator',
    es: 'Pterional derecho · abordaje transilviano — simulador microquirúrgico',
  },
  'start.disclaimerTitle': { en: 'Educational demonstration only', es: 'Solo con fines educativos' },
  'start.disclaimer': {
    en: 'This simulator is a simplified, stylized model created for education and demonstration. It is NOT a clinical training device, it has not been validated, and nothing in it is medical advice. Anatomy, physiology and outcomes are approximations and must not guide the care of any patient.',
    es: 'Este simulador es un modelo simplificado y estilizado creado con fines educativos y de demostración. NO es un dispositivo de entrenamiento clínico, no ha sido validado y nada de su contenido constituye consejo médico. La anatomía, la fisiología y los resultados son aproximaciones y no deben guiar la atención de ningún paciente.',
  },
  'start.case': {
    en: 'Case: unruptured 6.6 mm right IC-PC aneurysm, projecting posterolaterally and downward, with a small bleb on the dome.',
    es: 'Caso: aneurisma IC-PC derecho no roto de 6,6 mm, con proyección posterolateral e inferior y un pequeño bleb en la cúpula.',
  },
  'start.begin': { en: 'Enter the operating room', es: 'Entrar al quirófano' },
  'start.ack': { en: 'By continuing you acknowledge this is not medical advice.', es: 'Al continuar, reconoces que esto no es consejo médico.' },
  'start.language': { en: 'Language', es: 'Idioma' },
  'start.milestone': { en: 'Build M6 · complete simulator', es: 'Versión M6 · simulador completo' },

  'hud.mag': { en: 'MAG', es: 'AUM' },
  'hud.focus': { en: 'FOCUS', es: 'FOCO' },
  'hud.explorer': { en: 'Anatomy explorer', es: 'Explorador anatómico' },
  'hud.fissure': { en: 'Sylvian fissure opening', es: 'Apertura de la cisura de Silvio' },
  'hud.arachnoid': { en: 'Show arachnoid', es: 'Mostrar aracnoides' },
  'hud.labels': { en: 'Labels (L)', es: 'Etiquetas (L)' },
  'hud.resetView': { en: 'Reset view (R)', es: 'Restablecer vista (R)' },
  'hud.previewNote': {
    en: 'Preview controls. Tools that perform these steps arrive in M2.',
    es: 'Controles de vista previa. Las herramientas que realizan estos pasos llegan en M2.',
  },
  'hud.notMedical': { en: 'Educational demo — not medical advice', es: 'Demo educativa — no es consejo médico' },

  'ctl.title': { en: 'Microscope controls', es: 'Controles del microscopio' },
  'ctl.tilt': { en: 'Drag / right-drag — tilt', es: 'Arrastrar / clic derecho — inclinar' },
  'ctl.pan': { en: 'Middle-drag or Shift+drag — pan', es: 'Clic central o Shift+arrastrar — desplazar' },
  'ctl.zoom': { en: 'Wheel / pinch — zoom', es: 'Rueda / pellizco — zoom' },
  'ctl.focus': { en: 'Focus follows the cursor', es: 'El foco sigue al cursor' },

  'anat.frontal': { en: 'Frontal lobe', es: 'Lóbulo frontal' },
  'anat.temporal': { en: 'Temporal lobe', es: 'Lóbulo temporal' },
  'anat.ica': { en: 'ICA', es: 'ACI' },
  'anat.m1': { en: 'M1', es: 'M1' },
  'anat.m2': { en: 'M2', es: 'M2' },
  'anat.a1': { en: 'A1', es: 'A1' },
  'anat.pcom': { en: 'PCom', es: 'AComP' },
  'anat.acha': { en: 'AChA', es: 'A. coroidea anterior' },
  'anat.ssv': { en: 'Superficial sylvian vein', es: 'Vena silviana superficial' },
  'anat.optic': { en: 'Optic nerve (CN II)', es: 'Nervio óptico (II)' },
  'anat.cn3': { en: 'Oculomotor nerve (CN III)', es: 'Nervio oculomotor (III)' },
  'anat.aneurysm': { en: 'IC-PC aneurysm', es: 'Aneurisma IC-PC' },
  'anat.m2sup': { en: 'M2 superior trunk', es: 'M2 tronco superior' },
  'anat.m2inf': { en: 'M2 inferior trunk', es: 'M2 tronco inferior' },
  'hud.labelsShort': { en: 'Labels · L', es: 'Etiquetas · L' },
  'hud.resetShort': { en: 'Reset view · R', es: 'Vista inicial · R' },
  'hud.tempOn': { en: 'TEMP CLIP ON', es: 'CLIP TEMPORAL' },
  'ctl.tools': { en: 'Keys 1–0 pick an instrument; Esc puts it down', es: 'Teclas 1–0 eligen instrumento; Esc lo suelta' },
  'ctl.toolCamera': { en: 'Right-drag tilts the scope · Shift+wheel zooms · Esc puts the instrument down', es: 'Clic derecho inclina el microscopio · Shift+rueda hace zoom · Esc suelta el instrumento' },
  'clip.straight': { en: 'STRAIGHT', es: 'RECTO' },
  'clip.curved': { en: 'CURVED', es: 'CURVO' },

  'tool.suction': { en: 'Suction', es: 'Aspirador' },
  'tool.suction.hint': { en: 'Hold the click to aspirate CSF and blood. Never apply suction directly on the cortex or the aneurysm dome.', es: 'Mantén el clic para aspirar LCR y sangre. Nunca aspires directamente sobre la corteza ni sobre la cúpula del aneurisma.' },
  'tool.scissors': { en: 'Micro scissors', es: 'Microtijeras' },
  'tool.scissors.hint': { en: 'Click an arachnoid segment (highlighted) to open it sharply. Cut only membranes and bands, never vessels.', es: 'Haz clic en un segmento de aracnoides (resaltado) para abrirlo de forma cortante. Corta solo membranas y bandas, nunca vasos.' },
  'tool.bipolar': { en: 'Bipolar forceps', es: 'Pinza bipolar' },
  'tool.bipolar.hint': { en: 'Click to coagulate small bleeding points and pial vessels. Never coagulate major arteries, perforators, nerves or the dome.', es: 'Haz clic para coagular puntos sangrantes pequeños y vasos piales. Nunca coagules arterias mayores, perforantes, nervios ni la cúpula.' },
  'tool.dissector': { en: 'Micro dissector', es: 'Microdisector' },
  'tool.dissector.hint': { en: 'Drag along the aneurysm NECK, on its proximal and distal sides, to release the adhesions. Keep away from the dome and the bleb.', es: 'Arrastra a lo largo del CUELLO del aneurisma, por sus lados proximal y distal, para liberar las adherencias. Evita la cúpula y el bleb.' },
  'tool.spatula': { en: 'Brain spatula', es: 'Espátula cerebral' },
  'tool.spatula.hint': { en: 'Press on the frontal or temporal lobe and drag away from the fissure to widen it. You can only open as far as the arachnoid you have cut.', es: 'Presiona sobre el lóbulo frontal o temporal y arrastra alejándote de la cisura para ampliarla. Solo podrás abrir hasta donde hayas cortado la aracnoides.' },
  'tool.clip': { en: 'Aneurysm clip', es: 'Clip de aneurisma' },
  'tool.clip.hint': { en: 'Click on the neck to fix the position, adjust, then click again to close the clip.', es: 'Haz clic en el cuello para fijar la posición, ajusta y vuelve a hacer clic para cerrar el clip.' },
  'tool.clip.keys': { en: 'Q/E rotate · wheel = blade depth · [ ] blade length 5/7/9 mm · C straight/curved · Esc re-aim · X remove last clip', es: 'Q/E girar · rueda = profundidad de las ramas · [ ] longitud 5/7/9 mm · C recto/curvo · Esc reapuntar · X retirar último clip' },
  'tool.icg': { en: 'ICG angiography', es: 'Angiografía ICG' },
  'tool.icg.hint': { en: 'Injects ICG and switches to the near-infrared view: filling vessels glow. Click to re-inject; press 7 or Esc to return to white light.', es: 'Inyecta ICG y cambia a la vista de infrarrojo cercano: los vasos que se llenan brillan. Clic para reinyectar; 7 o Esc para volver a la luz blanca.' },
  'tool.doppler': { en: 'Micro Doppler', es: 'Microdoppler' },
  'tool.doppler.hint': { en: 'Rest the probe on a vessel. A pulsatile sound means flow; silence means no flow.', es: 'Apoya la sonda sobre un vaso. Un sonido pulsátil indica flujo; el silencio, ausencia de flujo.' },
  'tool.endoscope': { en: 'Endoscope', es: 'Endoscopio' },
  'tool.endoscope.hint': { en: 'Shows a picture-in-picture view from behind the aneurysm. Drag or Q/E to orbit around the neck.', es: 'Muestra una vista en miniatura desde detrás del aneurisma. Arrastra o usa Q/E para girar alrededor del cuello.' },
  'tool.tempclip': { en: 'Temporary clip', es: 'Clip temporal' },
  'tool.tempclip.hint': { en: 'Click the ICA proximal to the PCom to occlude it temporarily. Click again to remove it. Keep occlusion short.', es: 'Haz clic en la ACI proximal a la AComP para ocluirla temporalmente. Vuelve a hacer clic para retirarlo. Mantén la oclusión breve.' },

  'ui.procedure': { en: 'Procedure', es: 'Procedimiento' },
  'ui.mentor': { en: 'MENTOR', es: 'MENTOR' },
  'ui.allDone': { en: 'All stages complete. Check everything once more, then open the debrief.', es: 'Todas las etapas completadas. Revísalo todo una vez más y abre el informe.' },
  'ui.allDoneShort': { en: 'Procedure complete', es: 'Procedimiento completado' },

  'stage.fissure.title': { en: 'Open the sylvian fissure', es: 'Abrir la cisura de Silvio' },
  'stage.fissure.instr': { en: 'Start laterally, on the frontal side of the superficial sylvian vein. Open the arachnoid sharply with the micro scissors, then let the spatulas gently follow your dissection. The opening comes from dissection, not from pulling.', es: 'Empieza por lateral, en el lado frontal de la vena silviana superficial. Abre la aracnoides con las microtijeras y deja que las espátulas acompañen suavemente tu disección. La apertura la da la disección, no la tracción.' },
  'stage.m1.title': { en: 'Identify M1', es: 'Identificar M1' },
  'stage.m1.instr': { en: 'Follow the M2 branches deep into the fissure until they join M1. M1 is your road map: tracing it medially leads you to the carotid bifurcation. Touch it gently and confirm its flow with the Doppler.', es: 'Sigue las ramas M2 hacia la profundidad de la cisura hasta que se unen en M1. M1 es tu mapa: siguiéndola hacia medial llegarás a la bifurcación carotídea. Tócala con suavidad y confirma su flujo con el Doppler.' },
  'stage.ica.title': { en: 'Identify the ICA and optic nerve', es: 'Identificar la ACI y el nervio óptico' },
  'stage.ica.instr': { en: 'Open the carotid cistern to release CSF; the brain will relax and give you room. The optic nerve lies medial to the ICA. The opticocarotid triangle between them is a key landmark.', es: 'Abre la cisterna carotídea para liberar LCR; el cerebro se relajará y te dará espacio. El nervio óptico está medial a la ACI. El triángulo opticocarotídeo entre ambos es una referencia clave.' },
  'stage.neck.title': { en: 'Confirm the PCom and dissect the neck', es: 'Confirmar la AComP y disecar el cuello' },
  'stage.neck.instr': { en: 'The PCom arises from the posterior wall of the ICA, just under the aneurysm, and the AChA a few millimetres distal to it. Identify both before anything else. Then free the neck on both sides with gentle sweeps of the dissector. Never push on the dome or the bleb.', es: 'La AComP nace de la pared posterior de la ACI, justo por debajo del aneurisma, y la coroidea anterior unos milímetros más distal. Identifica ambas antes de nada. Después libera el cuello por ambos lados con barridos suaves del disector. Nunca empujes la cúpula ni el bleb.' },
  'stage.clip.title': { en: 'Clip the aneurysm', es: 'Clipar el aneurisma' },
  'stage.clip.instr': { en: 'Set the blades parallel to the ICA so they cross the whole neck, with the tips beyond its far side. Make sure the PCom and AChA stay out of the blades, then close the clip slowly. Remove the temporary clip as soon as the clip is secure.', es: 'Coloca las ramas paralelas a la ACI de modo que crucen todo el cuello, con las puntas más allá de su lado opuesto. Asegúrate de que la AComP y la coroidea anterior queden fuera de las ramas y cierra el clip despacio. Retira el clip temporal en cuanto el clip esté seguro.' },
  'stage.patency.title': { en: 'Confirm PCom patency', es: 'Confirmar la permeabilidad de la AComP' },
  'stage.patency.instr': { en: 'Verify the result. Run ICG: the ICA, PCom and AChA should light up while the dome stays dark. With the Doppler, the branches should sound pulsatile and the dome should be silent. If something is wrong, remove the clip (X) and reposition it.', es: 'Verifica el resultado. Haz una ICG: la ACI, la AComP y la coroidea anterior deben iluminarse mientras la cúpula queda oscura. Con el Doppler, las ramas deben sonar pulsátiles y la cúpula en silencio. Si algo falla, retira el clip (X) y recolócalo.' },

  'task.superficial': { en: 'Cut the superficial sylvian arachnoid', es: 'Cortar la aracnoides silviana superficial' },
  'task.deepBands': { en: 'Cut the deep sylvian bands', es: 'Cortar las bandas silvianas profundas' },
  'task.retract': { en: 'Widen the corridor with the spatulas', es: 'Ampliar el corredor con las espátulas' },
  'task.touchM1': { en: 'Touch M1 (dissector or Doppler)', es: 'Tocar M1 (disector o Doppler)' },
  'task.dopplerM1': { en: 'Confirm M1 flow with the Doppler', es: 'Confirmar el flujo de M1 con el Doppler' },
  'task.carotidCistern': { en: 'Open the carotid cistern', es: 'Abrir la cisterna carotídea' },
  'task.touchIca': { en: 'Identify the ICA', es: 'Identificar la ACI' },
  'task.ocMembrane': { en: 'Open the opticocarotid membrane', es: 'Abrir la membrana opticocarotídea' },
  'task.touchOptic': { en: 'Identify the optic nerve (touch with the dissector)', es: 'Identificar el nervio óptico (tocar con el disector)' },
  'task.neckArachnoid': { en: 'Open the arachnoid over the neck', es: 'Abrir la aracnoides sobre el cuello' },
  'task.pcom': { en: 'Identify the PCom', es: 'Identificar la AComP' },
  'task.acha': { en: 'Identify the AChA', es: 'Identificar la coroidea anterior' },
  'task.proxNeck': { en: 'Free the proximal neck', es: 'Liberar el cuello proximal' },
  'task.distNeck': { en: 'Free the distal neck', es: 'Liberar el cuello distal' },
  'task.tempOptional': { en: 'Optional: temporary clip for proximal control', es: 'Opcional: clip temporal para control proximal' },
  'task.applyClip': { en: 'Apply a definitive clip across the neck', es: 'Colocar un clip definitivo a través del cuello' },
  'task.tempRemoved': { en: 'No temporary clip left on the ICA', es: 'Ningún clip temporal en la ACI' },
  'task.dopplerPcom': { en: 'Doppler on the PCom after clipping', es: 'Doppler en la AComP tras el clipaje' },
  'task.dopplerAcha': { en: 'Doppler on the AChA after clipping', es: 'Doppler en la coroidea anterior tras el clipaje' },
  'task.dopplerDome': { en: 'Doppler on the dome after clipping', es: 'Doppler en la cúpula tras el clipaje' },

  'msg.stageDone': { en: 'Stage complete: {stage}', es: 'Etapa completada: {stage}' },
  'msg.procedureDone': { en: 'All stages complete. Well done.', es: 'Todas las etapas completadas. Bien hecho.' },
  'msg.clipEarly': { en: 'Clipping before the neck is free risks a residual neck or a caught branch.', es: 'Clipar antes de liberar el cuello conlleva riesgo de cuello residual o de atrapar una rama.' },
  'ctl.help': { en: 'H shows or hides this help', es: 'H muestra u oculta esta ayuda' },
  'ctl.mentor': { en: 'M collapses the mentor panel', es: 'M pliega el panel del mentor' },
  'vit.title': { en: 'Vitals', es: 'Constantes' },
  'vit.ebl': { en: 'EBL', es: 'PÉRDIDA' },
  'vit.opTime': { en: 'OP TIME', es: 'T. QUIRÚRGICO' },
  'vit.occlusion': { en: 'TEMP OCCL', es: 'OCLUSIÓN TEMP' },
  'vit.mute': { en: 'Sound on', es: 'Sonido sí' },
  'vit.unmute': { en: 'Muted', es: 'Silenciado' },
  'alarm.rupture': { en: 'RUPTURE', es: 'ROTURA' },
  'alarm.mapLow': { en: 'LOW BP', es: 'PA BAJA' },
  'alarm.hrHigh': { en: 'TACHYCARDIA', es: 'TAQUICARDIA' },
  'alarm.spo2': { en: 'LOW SpO₂', es: 'SpO₂ BAJA' },
  'alarm.mep': { en: 'MEP DROP', es: 'CAÍDA MEP' },
  'alarm.occlusion': { en: 'LONG OCCLUSION', es: 'OCLUSIÓN LARGA' },
  'emg.title': { en: 'Intraoperative rupture', es: 'Rotura intraoperatoria' },
  'emg.text': { en: 'Stay calm. First a clear view with suction, then proximal control.', es: 'Mantén la calma. Primero, visión clara con el aspirador; después, control proximal.' },
  'emg.suction': { en: 'Suction the pool to see the field (1)', es: 'Aspira el charco para ver el campo (1)' },
  'emg.temp': { en: 'Temporary clip on the proximal ICA (0)', es: 'Clip temporal en la ACI proximal (0)' },
  'emg.clip': { en: 'Definitive clip across the neck (6)', es: 'Clip definitivo a través del cuello (6)' },
  'msg.rupture': { en: 'RUPTURE! Arterial bleeding from the dome. Suction, proximal control, then clip.', es: '¡ROTURA! Sangrado arterial de la cúpula. Aspira, control proximal y después clip.' },
  'msg.ruptureSealed': { en: 'Bleeding controlled: the clip has closed the rupture.', es: 'Sangrado controlado: el clip ha cerrado la rotura.' },
  'msg.oozeStart': { en: 'Small bleeding point. Coagulate it with the bipolar (3).', es: 'Pequeño punto sangrante. Coagúlalo con la bipolar (3).' },
  'msg.oozeStopped': { en: 'Bleeding point coagulated.', es: 'Punto sangrante coagulado.' },
  'msg.bipolarRupture': { en: 'The bipolar cannot close an aneurysm rupture, and it may tear it further.', es: 'La bipolar no puede cerrar una rotura aneurismática y puede desgarrarla más.' },
  'msg.suctionFirst': { en: 'Suction the blood first so you can see the bleeding point.', es: 'Aspira primero la sangre para ver el punto sangrante.' },
  'task.icgAfterClip': { en: 'Run ICG after clipping (7)', es: 'Realizar ICG tras el clipaje (7)' },
  'task.icaPatent': { en: 'Doppler: ICA not narrowed', es: 'Doppler: ACI sin estenosis' },
  'task.endoOptional': { en: 'Optional: endoscopic look behind the neck (9)', es: 'Opcional: revisión endoscópica tras el cuello (9)' },
  'fail.pcom': { en: 'No PCom flow: a blade has caught it. Remove the clip (X) and reposition.', es: 'Sin flujo en la AComP: una rama del clip la atrapa. Retira el clip (X) y recolócalo.' },
  'fail.acha': { en: 'No AChA flow: risk of capsular infarct. Reposition the clip now.', es: 'Sin flujo en la coroidea anterior: riesgo de infarto capsular. Recoloca el clip ya.' },
  'fail.dome': { en: 'The dome still fills: the neck is not fully closed. Blades deeper, longer or lower.', es: 'La cúpula sigue llenándose: el cuello no está cerrado del todo. Ramas más profundas, más largas o más bajas.' },
  'fail.ica': { en: 'Weak ICA signal: the clip is narrowing the parent artery. Lift the blades off the ICA.', es: 'Señal débil en la ACI: el clip estrecha la arteria madre. Separa las ramas de la ACI.' },
  'endo.label': { en: 'ENDOSCOPE 30° · behind the neck', es: 'ENDOSCOPIO 30° · tras el cuello' },
  'endo.hint': { en: 'Drag or Q/E to orbit · wheel = distance', es: 'Arrastra o Q/E para girar · rueda = distancia' },
  'start.demo': { en: 'Watch the demo (click anytime to take over)', es: 'Ver la demostración (haz clic cuando quieras para tomar el control)' },
  'hud.demo': { en: 'Demo', es: 'Demo' },
  'hud.endCase': { en: 'End case · debrief', es: 'Terminar · informe' },
  'hud.qualityHigh': { en: 'Quality: high', es: 'Calidad: alta' },
  'hud.qualityLow': { en: 'Quality: low', es: 'Calidad: baja' },
  'demo.banner': { en: 'DEMO MODE · click or press any key to take over', es: 'MODO DEMO · haz clic o pulsa una tecla para tomar el control' },
  'demo.s1': { en: 'Demo · Opening the sylvian arachnoid from lateral to medial, then gentle retraction.', es: 'Demo · Apertura de la aracnoides silviana de lateral a medial y retracción suave.' },
  'demo.s2': { en: 'Demo · Following M2 down to M1 and confirming its flow with the Doppler.', es: 'Demo · Siguiendo M2 hasta M1 y confirmando su flujo con el Doppler.' },
  'demo.s3': { en: 'Demo · Opening the carotid cistern and the opticocarotid membrane.', es: 'Demo · Apertura de la cisterna carotídea y de la membrana opticocarotídea.' },
  'demo.s4': { en: 'Demo · PCom and AChA identified, proximal control, neck dissection on both sides.', es: 'Demo · AComP y coroidea anterior identificadas, control proximal y disección del cuello por ambos lados.' },
  'demo.s5': { en: 'Demo · Clip across the neck base, parallel to the ICA, then the temporary clip comes off.', es: 'Demo · Clip en la base del cuello, paralelo a la ACI; después se retira el clip temporal.' },
  'demo.s6': { en: 'Demo · Verification with ICG, Doppler and the endoscope.', es: 'Demo · Verificación con ICG, Doppler y endoscopio.' },
  'msg.demoTakeOver': { en: 'You have control. Carry on from here.', es: 'Tienes el control. Continúa desde aquí.' },

  'db.eyebrow': { en: 'CASE DEBRIEF', es: 'INFORME DEL CASO' },
  'db.title': { en: 'Right IC-PC aneurysm · pterional transsylvian clipping', es: 'Aneurisma IC-PC derecho · clipaje pterional transilviano' },
  'db.time': { en: 'Total time', es: 'Tiempo total' },
  'db.ebl': { en: 'Blood loss', es: 'Pérdida de sangre' },
  'db.occlusion': { en: 'Temporary occlusion', es: 'Oclusión temporal' },
  'db.rupture': { en: 'Intraoperative rupture', es: 'Rotura intraoperatoria' },
  'db.ruptureYes': { en: 'Yes, uncontrolled', es: 'Sí, no controlada' },
  'db.ruptureYesSealed': { en: 'Yes, controlled', es: 'Sí, controlada' },
  'db.minMap': { en: 'Lowest mean BP', es: 'PA media mínima' },
  'db.minMep': { en: 'Lowest MEP', es: 'MEP mínimo' },
  'db.clipResult': { en: 'Clip result', es: 'Resultado del clip' },
  'db.neckClosure': { en: 'Aneurysm excluded', es: 'Aneurisma excluido' },
  'db.residual': { en: 'Residual neck', es: 'Cuello residual' },
  'db.icaNarrowing': { en: 'ICA narrowing', es: 'Estenosis de la ACI' },
  'db.pcom': { en: 'PCom', es: 'AComP' },
  'db.acha': { en: 'AChA', es: 'Coroidea anterior' },
  'db.clips': { en: 'Clips', es: 'Clips' },
  'db.patent': { en: 'patent', es: 'permeable' },
  'db.occluded': { en: 'OCCLUDED', es: 'OCLUIDA' },
  'db.yes': { en: 'yes', es: 'sí' },
  'db.no': { en: 'No', es: 'No' },
  'db.tips': { en: 'How to improve', es: 'Cómo mejorar' },
  'db.disclaimer': { en: 'Educational simulation only. These results do not reflect real clinical performance and are not medical advice.', es: 'Solo simulación educativa. Estos resultados no reflejan el desempeño clínico real y no son consejo médico.' },
  'db.back': { en: 'Back to the field', es: 'Volver al campo' },
  'db.restart': { en: 'Restart the case', es: 'Reiniciar el caso' },
  'verdict.none': { en: 'No clip applied', es: 'Sin clip' },
  'verdict.complete': { en: 'Complete occlusion', es: 'Oclusión completa' },
  'verdict.residual': { en: 'Residual neck', es: 'Cuello residual' },
  'verdict.incomplete': { en: 'Incomplete occlusion', es: 'Oclusión incompleta' },
  'verdict.stenosis': { en: 'Parent artery narrowed', es: 'Arteria madre estenosada' },
  'verdict.branch': { en: 'Branch occluded', es: 'Rama ocluida' },
  'tip.ruptureBleb': { en: 'The rupture followed manipulation of the bleb. Keep instruments on the neck and never touch the bleb or the thin dome.', es: 'La rotura siguió a la manipulación del bleb. Mantén los instrumentos en el cuello y no toques nunca el bleb ni la cúpula fina.' },
  'tip.ruptureDome': { en: 'The rupture followed repeated pressure on the dome. Dissect at the neck with short, gentle sweeps.', es: 'La rotura siguió a presiones repetidas sobre la cúpula. Diseca en el cuello con barridos cortos y suaves.' },
  'tip.proximalControl': { en: 'Prepare proximal control (expose the proximal ICA) before dissecting the neck, so a temporary clip is ready if the sac bleeds.', es: 'Prepara el control proximal (expón la ACI proximal) antes de disecar el cuello, para tener listo un clip temporal si el saco sangra.' },
  'tip.riskyHandling': { en: 'The dome was handled more than needed. It did not rupture this time, but each touch adds risk.', es: 'La cúpula se manipuló más de lo necesario. Esta vez no se rompió, pero cada contacto suma riesgo.' },
  'tip.noClip': { en: 'No definitive clip was applied: the aneurysm remains untreated.', es: 'No se colocó un clip definitivo: el aneurisma sigue sin tratar.' },
  'tip.residual': { en: 'The blades sat too high on the sac and left a residual neck that can regrow. Seat them at the base, flush with the ICA wall.', es: 'Las ramas quedaron demasiado altas en el saco y dejaron un cuello residual que puede recrecer. Colócalas en la base, a ras de la pared de la ACI.' },
  'tip.incomplete': { en: 'The blades did not span the whole flattened neck. Use a longer blade, advance the clip deeper, or align it across the sac.', es: 'Las ramas no abarcaron todo el cuello aplanado. Usa una rama más larga, avanza más el clip o alinéalo atravesando el saco.' },
  'tip.stenosis': { en: 'The blades bit into the ICA and narrowed it. Lift them slightly off the parent artery and keep them parallel to it.', es: 'Las ramas mordieron la ACI y la estrecharon. Sepáralas ligeramente de la arteria madre y mantenlas paralelas a ella.' },
  'tip.pcomCaught': { en: 'The PCom was caught in the blades. Identify its origin under the neck (endoscope) before closing, and keep the tips above it.', es: 'La AComP quedó atrapada entre las ramas. Identifica su origen bajo el cuello (endoscopio) antes de cerrar y mantén las puntas por encima.' },
  'tip.achaCaught': { en: 'The AChA was caught: this risks a capsular infarct with hemiplegia. Free it from the distal neck and reposition.', es: 'La coroidea anterior quedó atrapada: riesgo de infarto capsular con hemiplejía. Libérala del cuello distal y recoloca.' },
  'tip.dissection': { en: 'The neck was not fully freed on both sides. Complete dissection lets the blades pass cleanly across.', es: 'El cuello no se liberó por completo en ambos lados. Una disección completa permite que las ramas pasen limpiamente.' },
  'tip.icg': { en: 'No ICG was done after clipping. Always verify the clip with ICG and Doppler before closing.', es: 'No se hizo ICG tras el clipaje. Verifica siempre el clip con ICG y Doppler antes de cerrar.' },
  'tip.endoscope': { en: 'An endoscopic look behind the neck can reveal a hidden caught PCom or a residual neck.', es: 'Una revisión endoscópica tras el cuello puede revelar una AComP atrapada o un cuello residual ocultos.' },
  'tip.occlusion': { en: 'Temporary occlusion exceeded 5 minutes. Use shorter, intermittent occlusions and reperfuse between them.', es: 'La oclusión temporal superó los 5 minutos. Usa oclusiones más cortas e intermitentes y reperfunde entre ellas.' },
  'tip.retraction': { en: 'The spatulas pulled against intact arachnoid. Open the fissure by dissection first; retraction should follow, not lead.', es: 'Las espátulas tiraron contra aracnoides intacta. Abre la cisura primero disecando; la retracción debe acompañar, no ir por delante.' },
  'tip.injuries': { en: 'Structures injured:', es: 'Estructuras lesionadas:' },
  'tip.ebl': { en: 'Blood loss was high. Suction early, get proximal control quickly and clip decisively.', es: 'La pérdida de sangre fue alta. Aspira pronto, consigue control proximal rápido y clipa con decisión.' },
  'tip.tempLeft': { en: 'The temporary clip was still on the ICA at the end.', es: 'El clip temporal seguía puesto en la ACI al final.' },
  'tip.mildStenosis': { en: 'The ICA was mildly narrowed by the blades. Seat them a little further from the parent artery.', es: 'Las ramas estrecharon levemente la ACI. Colócalas un poco más separadas de la arteria madre.' },
  'tip.excellent': { en: 'Excellent: the aneurysm is excluded and the PCom, AChA and ICA are preserved.', es: 'Excelente: el aneurisma está excluido y la AComP, la coroidea anterior y la ACI se preservan.' },
  'msg.comingLater': { en: 'This instrument arrives in a later build (M5).', es: 'Este instrumento llegará en una versión posterior (M5).' },
  'msg.csfRelease': { en: 'Carotid cistern open: CSF drains and the brain relaxes.', es: 'Cisterna carotídea abierta: sale LCR y el cerebro se relaja.' },
  'msg.neckFreeProx': { en: 'Proximal neck free.', es: 'Cuello proximal liberado.' },
  'msg.neckFreeDist': { en: 'Distal neck free.', es: 'Cuello distal liberado.' },
  'msg.scissorsArtery': { en: 'Danger: never cut an artery! Vessel injury recorded.', es: 'Peligro: ¡nunca cortes una arteria! Lesión vascular registrada.' },
  'msg.scissorsVein': { en: 'Careful: preserve the veins whenever possible.', es: 'Cuidado: preserva las venas siempre que sea posible.' },
  'msg.scissorsDome': { en: 'Danger: scissors on the aneurysm dome!', es: 'Peligro: ¡tijeras sobre la cúpula del aneurisma!' },
  'msg.scissorsNerve': { en: 'Danger: cranial nerve injury!', es: 'Peligro: ¡lesión de nervio craneal!' },
  'msg.scissorsOnlyArachnoid': { en: 'Scissors are for arachnoid and bands only.', es: 'Las tijeras son solo para aracnoides y bandas.' },
  'msg.useScissorsSylvian': { en: 'Open the sylvian arachnoid sharply with the scissors.', es: 'Abre la aracnoides silviana de forma cortante con las tijeras.' },
  'msg.blebTouch': { en: 'Do not touch the bleb: it is the most fragile part of the dome.', es: 'No toques el bleb: es la parte más frágil de la cúpula.' },
  'msg.domeTouch': { en: 'Avoid pressing on the dome. Dissect at the neck.', es: 'Evita presionar la cúpula. Diseca a nivel del cuello.' },
  'msg.bipolarArtery': { en: 'Danger: never coagulate a major artery!', es: 'Peligro: ¡nunca coagules una arteria mayor!' },
  'msg.bipolarPerforator': { en: 'Danger: coagulating the PCom/AChA risks an infarct!', es: 'Peligro: coagular la AComP o la coroidea anterior puede causar un infarto.' },
  'msg.bipolarVein': { en: 'Careful: preserve the sylvian veins.', es: 'Cuidado: preserva las venas silvianas.' },
  'msg.bipolarDome': { en: 'Danger: bipolar on the dome can make it rupture!', es: 'Peligro: ¡la bipolar sobre la cúpula puede romperla!' },
  'msg.bipolarNerve': { en: 'Danger: thermal injury to the nerve!', es: 'Peligro: ¡lesión térmica del nervio!' },
  'msg.suctionCortex': { en: 'Protect the cortex: suction over a cottonoid, not directly on the pia.', es: 'Protege la corteza: aspira sobre un cotonoide, no directamente sobre la piamadre.' },
  'msg.suctionDome': { en: 'Danger: never apply suction to the aneurysm dome!', es: 'Peligro: ¡nunca aspires sobre la cúpula del aneurisma!' },
  'msg.spatulaClosed': { en: 'The fissure is still closed. Cut the sylvian arachnoid first.', es: 'La cisura sigue cerrada. Corta primero la aracnoides silviana.' },
  'msg.spatulaTethered': { en: 'Arachnoid is still tethering the lobes. Cut more before retracting.', es: 'La aracnoides aún sujeta los lóbulos. Corta más antes de retraer.' },
  'msg.clipLocked': { en: 'Position fixed. Q/E to rotate, wheel for depth, click to close.', es: 'Posición fijada. Q/E para girar, rueda para profundidad, clic para cerrar.' },
  'msg.clipApplied': { en: 'Clip closed. Verify it: ICG (7) and Doppler (8) on the PCom, AChA, ICA and dome.', es: 'Clip cerrado. Verifícalo: ICG (7) y Doppler (8) en la AComP, la coroidea anterior, la ACI y la cúpula.' },
  'msg.clipRemoved': { en: 'Clip removed.', es: 'Clip retirado.' },
  'msg.clipMax': { en: 'Three clips is the limit in this simulator.', es: 'El límite en este simulador es de tres clips.' },
  'msg.tempOnlyIca': { en: 'Place the temporary clip on the ICA.', es: 'Coloca el clip temporal sobre la ACI.' },
  'msg.tempTooDistal': { en: 'Too distal: place it on the ICA proximal to the PCom.', es: 'Demasiado distal: colócalo en la ACI proximal a la AComP.' },
  'msg.tempOn': { en: 'Temporary clip on: ICA flow stopped. Work efficiently.', es: 'Clip temporal colocado: flujo de la ACI detenido. Trabaja con eficiencia.' },
  'msg.tempOff': { en: 'Temporary clip removed: flow restored.', es: 'Clip temporal retirado: flujo restablecido.' },
};

let current: Lang = 'es';
try {
  const saved = localStorage.getItem('sim.lang');
  if (saved === 'en' || saved === 'es') current = saved;
  else if (!navigator.language.toLowerCase().startsWith('es')) current = 'en';
} catch {
  /* storage unavailable: keep default */
}

export function t(key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[current];
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem('sim.lang', lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
  applyTranslations();
  events.emit('lang:changed', { lang });
}

/** Updates every element carrying a data-i18n attribute. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
}

/** Builds an EN | ES segmented toggle. */
export function createLangToggle(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'lang-toggle';
  for (const lang of ['en', 'es'] as Lang[]) {
    const b = document.createElement('button');
    b.textContent = lang.toUpperCase();
    b.dataset.lang = lang;
    b.addEventListener('click', () => setLang(lang));
    wrap.appendChild(b);
  }
  const sync = () =>
    wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.lang === current));
  sync();
  events.on('lang:changed', sync);
  return wrap;
}
