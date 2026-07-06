'use strict';
// ============================== DATOS Y CONSTANTES ==============================
const TW = 16, MW = 100, MH = 70;         // tamaño de tile y del mapa
const DAY_LEN = 240;                      // segundos que dura un día (4 minutos)
const INV_CAP = 15;                       // capacidad de la mochila de cada colono
const SAVE_KEY = 'miniColoniaSaveV11';
const SEASON_DAYS = 5;                    // días que dura cada estación (año = ~80 min)
const SEASONS = [
  { id:'spring', name:'Primavera', emoji:'🌸' },
  { id:'summer', name:'Verano',    emoji:'☀️' },
  { id:'autumn', name:'Otoño',     emoji:'🍂' },
  { id:'winter', name:'Invierno',  emoji:'❄️' },
];
const SKILLS = [
  { id:'build',    icon:'🔨', name:'Construir' },
  { id:'farm',     icon:'🌾', name:'Cultivar' },
  { id:'cook',     icon:'🍲', name:'Cocinar' },
  { id:'craft',    icon:'⚒️', name:'Fabricar' },
  { id:'gather',   icon:'🪓', name:'Recolectar' },
  { id:'hunt',     icon:'🏹', name:'Cazar' },
  { id:'research', icon:'📚', name:'Investigar' },
  { id:'medic',    icon:'🩺', name:'Curar' },
];
const SKILL_OF_TASK = {
  build:'build', sow:'farm', harvestCrop:'farm', cook:'cook', craft:'craft',
  chop:'gather', mine:'gather', harvest:'gather', hunt:'hunt', fish:'hunt',
  research:'research', treat:'medic',
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const NAMES = ['Ana','Beto','Carla','Darío','Elena','Fito','Gina','Hugo','Iris','Juan','Kiara','Lalo',
  'Mora','Nico','Olga','Pedro','Rosa','Santi','Tere','Ulises','Vera','Wanda','Yamila','Zoe',
  'Bruno','Camila','Diego','Emma','Facundo','Guada','Ismael','Julieta','Lisandro','Maite',
  'Nahuel','Ofelia','Paloma','Ramiro','Selva','Tomás','Alba','Ciro','Delfina','Emilio'];
const PAWN_COLORS = ['#e8b04b','#5bb5e0','#d96a6a','#8fd45e','#c98fe0','#e0925b','#6ae0c4','#e05bb0'];

const RES_EMOJI = { wood:'🪵', stone:'🪨', iron:'🔩', fiber:'🌿', food:'🍎', meat:'🍖', fish:'🐟',
                    guiso:'🍲', tools:'🔨', ropa:'👕', herb:'🌱', medicina:'💊', gold:'🪙' };
const RES_NAME  = { wood:'Madera', stone:'Piedra', iron:'Hierro', fiber:'Fibra', food:'Comida',
                    meat:'Carne', fish:'Pescado', guiso:'Guiso', tools:'Herramientas', ropa:'Ropa',
                    herb:'Hierbas', medicina:'Medicina', gold:'Oro' };
const DOG_NAMES = ['Rulo', 'Manchas', 'Tita', 'Chispa', 'Fideo', 'Greta', 'Bicho', 'Luna'];

const BUILDS = {
  wall:   { name:'Muro',    cost:{stone:2},        work:3.5, icon:'🧱', desc:'Bloquea el paso. Ideal para cerrar tu base.' },
  door:   { name:'Puerta',  cost:{wood:2},         work:3,   icon:'🚪', desc:'Los colonos pasan por acá. Completa los muros.' },
  floor:  { name:'Piso',    cost:{wood:1},         work:1.5, icon:'🟫', desc:'Piso de tablas: se camina un 25% más rápido y viste el interior.' },
  farol:  { name:'Farol',   cost:{wood:1,fiber:1}, work:2,   icon:'🏮', desc:'Ilumina la noche a su alrededor.' },
  bed:    { name:'Cama',    cost:{wood:4},         work:5,   icon:'🛏️', desc:'Dormir en cama da +8 de humor.' },
  table:  { name:'Mesa',    cost:{wood:3},         work:4,   icon:'🍽️', desc:'Comer cerca de una mesa da +4 de humor.' },
  fogata: { name:'Fogata',  cost:{wood:2},         work:2.5, icon:'🔥', desc:'De noche los colonos se juntan a charlar (+8 humor).' },
  fogon:  { name:'Fogón',   cost:{stone:4},        work:5,   icon:'🍲', desc:'Cocina guisos: 1 🍖 + 1 🍎 (o 3 🍎) → 1 🍲.' },
  taller: { name:'Taller',  cost:{wood:5,stone:3}, work:6,   icon:'⚒️', desc:'Fabrica herramientas (2 🪵 + 1 🔩 → 1 🔨, +15% trabajo).' },
  telar:  { name:'Telar',   cost:{wood:4},         work:5,   icon:'🧵', desc:'Teje ropa (4 🌿 → 1 👕, +5 de humor al que la usa).' },
  statue: { name:'Estatua', cost:{stone:5},        work:6,   icon:'🗿', desc:'Arte. Los colonos cercanos ganan +4 de humor y embellece la habitación.' },
  desk:   { name:'Escritorio', cost:{wood:5,fiber:1}, work:5, icon:'📚', desc:'Acá se investiga: elegí una tecnología en el panel 🧪.' },
  chair:  { name:'Silla',   cost:{wood:2},         work:2,   icon:'🪑', desc:'Comer sentado da +2 de humor. Embellece.', tech:'carpinteria' },
  shelf:  { name:'Estantería', cost:{wood:4},      work:3,   icon:'🗄️', desc:'Libros y orden: embellece mucho la habitación.', tech:'carpinteria' },
  chest:  { name:'Baúl',    cost:{wood:3},         work:3,   icon:'🧰', desc:'Depósito compacto: funciona como almacén y queda lindo adentro.' },
  brazier:{ name:'Brasero', cost:{stone:3,iron:1}, work:4,   icon:'♨️', desc:'Calor y luz para interiores: abriga como una fogata.', tech:'construccion' },
  medbed: { name:'Cama de enfermería', cost:{wood:4,fiber:2}, work:5, icon:'🏥', desc:'Los enfermos se recuperan mucho más rápido acá.', tech:'medicina' },
  pier:   { name:'Muelle', cost:{wood:4}, work:4, icon:'🎣', desc:'Se construye en la orilla: los colonos pescan 🐟 (sirve para el guiso).' },
};

// tecnologías investigables en el escritorio
const TECHS = [
  { id:'carpinteria',  name:'Carpintería fina',      cost:40, icon:'🪑', desc:'Desbloquea la silla y la estantería.' },
  { id:'medicina',     name:'Medicina herbal',       cost:60, icon:'💊', desc:'Desbloquea la enfermería y fabricar medicina (2 🌱 → 1 💊 en el taller).' },
  { id:'construccion', name:'Construcción avanzada', cost:70, icon:'♨️', desc:'Desbloquea el brasero, calor y luz para interiores.' },
  { id:'agricultura',  name:'Agricultura',           cost:60, icon:'🌾', desc:'Los cultivos rinden +1 de comida y crecen un 20% más rápido.' },
  { id:'textil',       name:'Telares mejorados',     cost:50, icon:'👕', desc:'La ropa cuesta solo 3 de fibra.' },
];

// cuánto embellece cada cosa (para el puntaje de la habitación)
const BEAUTY = { statue:8, shelf:4, brazier:3, table:2, farol:2, desk:2, medbed:2,
                 chair:1, bed:1, chest:1, telar:1, taller:1 };

const CATS = [
  { id:'orders', label:'⚑ Órdenes' },
  { id:'build',  label:'🔨 Construcción' },
  { id:'zones',  label:'🌱 Zonas' },
];
const TOOLS = [
  { id:'chop',    cat:'orders', icon:'🪓', name:'Talar',    desc:'Marca árboles para talar. Cada árbol da 6 de madera.' },
  { id:'mine',    cat:'orders', icon:'⛏️', name:'Minar',    desc:'Marca rocas para minar. Las vetas rojizas dan hierro 🔩.' },
  { id:'harvest', cat:'orders', icon:'🌿', name:'Cosechar', desc:'Marca bayas 🫐 (comida), fibra 🌿 (para tejer) y hierba medicinal 🌱.' },
  { id:'hunt',    cat:'orders', icon:'🏹', name:'Cazar',    desc:'Marca animales: conejo 🐇 = 2 carne, ciervo 🦌 = 6. ¡Se escapan!' },
  { id:'cancel',  cat:'orders', icon:'❌', name:'Cancelar', desc:'Quita órdenes, planos y zonas. También demuele construcciones (devuelve la mitad).' },
  ...Object.entries(BUILDS).map(([k, d]) => ({
    id: 'b:' + k, cat: 'build', icon: d.icon, name: d.name, desc: d.desc,
    cost: Object.entries(d.cost).map(([r, n]) => `${n} ${RES_EMOJI[r]}`).join(' '),
  })),
  { id:'farm',  cat:'zones', icon:'🌾', name:'Cultivo', desc:'Zona de cultivo: los colonos siembran y cosechan solos.' },
  { id:'stock', cat:'zones', icon:'📦', name:'Almacén', desc:'Acá se guardan los recursos. Los colonos depositan su mochila.' },
];

const PRIO_CATS = [
  { id:'medic',    icon:'🩺', name:'Curar' },
  { id:'build',    icon:'🔨', name:'Construir' },
  { id:'farm',     icon:'🌾', name:'Cultivar' },
  { id:'cook',     icon:'🍲', name:'Cocinar' },
  { id:'craft',    icon:'⚒️', name:'Fabricar' },
  { id:'research', icon:'📚', name:'Investigar' },
  { id:'gather',   icon:'🪓', name:'Recolectar' },
  { id:'hunt',     icon:'🏹', name:'Caza y pesca' },
  { id:'haul',     icon:'📦', name:'Acarrear' },
];
const PRIO_LABEL = { 0:'no lo hace', 1:'prioridad alta', 2:'prioridad normal', 3:'prioridad baja' };

const TASK_LABEL = {
  chop:'Talando 🪓', mine:'Minando ⛏️', harvest:'Cosechando 🌿', build:'Construyendo 🔨',
  sow:'Sembrando 🌱', harvestCrop:'Cosechando 🌾', haul:'Acarreando 📦', deposit:'Guardando 📦',
  eat:'Comiendo 🍎', eatHere:'Comiendo 🍎', eatInv:'Comiendo 🍎', eatBerry:'Comiendo bayas 🫐',
  sleep:'Durmiendo 💤', sleepHere:'Durmiendo en el suelo 💤', wander:'Paseando 🚶',
  social:'Yendo a charlar 💬', cook:'Cocinando 🍲', craft:'Fabricando ⚒️',
  campfire:'Junto a la fogata 🔥', hunt:'Cazando 🏹', follow:'Siguiendo a sus papás 👶',
  extinguish:'¡Apagando fuego! 🧯', research:'Investigando 📚', treat:'Curando a un enfermo 🩺',
  fish:'Pescando 🎣',
};

const TRAITS = {
  charlatan:  { name:'Charlatán 💬',  desc:'Charla mucho más seguido' },
  trabajador: { name:'Trabajador 💪', desc:'Trabaja un 20% más rápido' },
  dormilon:   { name:'Dormilón 😴',   desc:'Se cansa más rápido' },
  gloton:     { name:'Glotón 🍖',     desc:'Le da hambre más rápido' },
  optimista:  { name:'Optimista 🌞',  desc:'Siempre de buen humor (+10)' },
};
const TRAIT_KEYS = Object.keys(TRAITS);

const CHAT = {
  greet: ['¡Che, {n}!', 'Hola {n}, ¿todo bien?', '¿Cómo va eso, {n}?', '{n}, ¡qué día!', 'Ey {n}, ¿cómo andás?'],
  greetFriend: ['¡{n}, amigazo!', '¡Acá está mi persona favorita!', '¡{n}! Justo pensaba en vos.'],
  reply: ['Todo tranquilo por acá.', '¡Bárbaro!', 'Cansado, pero bien.', 'Acá andamos, laburando.',
          'No me quejo.', 'Mejor imposible.', 'Tirando, como siempre.'],
  topic: ['Dicen que van a llegar más viajeros.', 'Este lugar me gusta cada vez más.',
          '¿Probaste las bayas de por acá?', 'Habría que ampliar el almacén.',
          'Anoche escuché ruidos raros...', 'Con más muros dormiría más tranquilo.',
          'El cultivo viene creciendo lindo.', 'Extraño la civilización... a veces.',
          'Hoy el cielo está precioso.', 'Alguien debería ordenar el depósito.',
          'Un guiso calentito no le viene mal a nadie.', 'Vi una veta de hierro cerca del agua.',
          'Con esta fibra se puede tejer algo lindo.'],
  topicReply: ['¡Ojalá!', 'Puede ser...', 'Ja, ni me digas.', 'Tenés razón.', 'Mmm, no sé...',
               '¡Totalmente!', 'Después lo vemos.', 'Ja ja, sí.'],
  deep: ['Qué bueno tenerte acá, {n}.', 'Con vos da gusto laburar, {n}.', 'Sos de fierro, {n}.',
         'Si no fuera por vos, esto se caía a pedazos.'],
  joke: ['¿Qué hace un árbol aburrido? ¡Se planta!', '¿Sabés cómo se despide una roca? ¡Nos vemos piedra!',
         'Ayer dormí como un tronco... al lado de un tronco.', '¿El muro? Está que se cae de la risa.',
         'Mi guiso está tan rico que las bayas se anotan solas.'],
  laugh: ['¡Ja ja ja!', '¡Muy bueno! 😂', 'Ja, siempre igual vos.', '¡Basta, me duele la panza! 😂'],
  argue: ['¡Dejá de dejar todo tirado!', '¡Te toca a vos acarrear!', '¡Ese era mi lugar para dormir!',
          '¡Siempre lo mismo con vos!', '¡Vos te comiste mi guiso!'],
  argueReply: ['¡Ni loco!', '¡Mirá quién habla!', 'Bueno, che, tranquilo...', '¡Andá a cortar leña!'],
  work: ['Uf, esta piedra está dura.', '¡Tronco va!', 'Un poco más y termino...',
         'Esto queda joya.', 'El que quiere celeste...', 'Laburo digno.', '¡Cómo pesa esto!'],
  hungry: ['Me suenan las tripas...', 'Mataría por un guiso.', '¿Alguien vio comida?',
           'Qué hambre, por favor...', 'Ya no pienso, solo tengo hambre.'],
  tired: ['No doy más...', 'Necesito una cama ya.', 'Qué sueño...', 'Se me cierran los ojos.'],
  night: ['Qué linda noche.', 'Cuántas estrellas...', 'Hace fresco, ¿no?', 'Silencio total.'],
  campfire: ['Nada como un fueguito.', 'Pasame otro tronco.', 'Qué bien se está acá.', 'Mirá esas llamas...'],
  food: ['¡Qué rico estaba!', 'Comida es comida.', 'Ahora sí, a trabajar.'],
  join: ['¡Hola! ¿Puedo quedarme?', '¡Vengo de lejos, necesito refugio!', '¿Les sobra un plato de comida?'],
  flirt: ['Che {n}... qué lindos ojos tenés.', '¿Caminamos juntos hasta el lago?',
          'Hice este guiso pensando en vos.', 'Con vos hasta el invierno es lindo.',
          '{n}, ¿te dijeron que sos un sol?'],
  flirtReply: ['¡Ay, pará! 😊', 'Jaja, seguí, seguí...', '¿En serio decís?', '💕', 'Vos también, ¿eh?'],
  sweet: ['Qué suerte tenerte, {n}.', '¿Todo bien, mi amor?', 'Después te preparo algo rico.',
          'Hoy estás precioso/a.'],
  sweetReply: ['Te quiero 💕', 'Vos siempre tan dulce.', 'Ay, vení acá.', 'Ja, qué zalamero/a.'],
  cold: ['¡Me congelo!', 'Brrr... necesito abrigo.', '¿Y la fogata? ¡Qué frío!', 'No siento los dedos.'],
  sick: ['No me siento bien...', '¡Achís!', 'Me duele todo el cuerpo.', 'Necesito acostarme...',
         '¿Alguien tiene medicina?'],
};

const BACKSTORIES = [
  { id:'panadero', name:'Ex panadero/a',          skill:'cook',   ban:'hunt',  tale:'horneaba pan en la gran ciudad hasta que todo se vino abajo' },
  { id:'lenador',  name:'Leñador/a',              skill:'gather', ban:null,    tale:'creció entre hachas y aserrín' },
  { id:'furtivo',  name:'Cazador/a furtivo/a',    skill:'hunt',   ban:'farm',  tale:'vivía de lo que el bosque le daba... sin permiso' },
  { id:'albanil',  name:'Albañil',                skill:'build',  ban:null,    tale:'levantó media ciudad con sus propias manos' },
  { id:'granjero', name:'Granjero/a',             skill:'farm',   ban:'craft', tale:'nunca perdió una cosecha, hasta la gran sequía' },
  { id:'sastre',   name:'Sastre',                 skill:'craft',  ban:'hunt',  tale:'sus abrigos abrigaban hasta el alma' },
  { id:'fondero',  name:'Fondero/a',              skill:'cook',   ban:null,    tale:'su guiso era famoso en tres pueblos' },
  { id:'noble',    name:'Noble venido/a a menos', skill:null,     ban:'haul',  tale:'tenía sirvientes para todo; ya no' },
  { id:'minero',   name:'Minero/a',               skill:'gather', ban:null,    tale:'pasó media vida bajo tierra buscando vetas' },
  { id:'maestra',  name:'Maestro/a rural',        skill:'farm',   ban:null,    tale:'enseñaba a leer a los chicos del valle' },
  { id:'curandero',name:'Curandero/a',            skill:'medic',  ban:null,    tale:'las hierbas le hablan; la gente, a veces también' },
  { id:'erudito',  name:'Erudito/a',              skill:'research', ban:'gather', tale:'leía libros mientras el mundo se venía abajo' },
];
const BACKSTORY_BABY = { id:'nacido', name:'Nacido/a en la colonia', skill:null, ban:null,
                         tale:'primera generación de un mundo nuevo' };

const ANIMALS = {
  deer:   { emoji:'🦌', hp:3, meat:6, speed:26, name:'Ciervo' },
  rabbit: { emoji:'🐇', hp:1, meat:2, speed:22, name:'Conejo' },
};

const TRADE_GOODS = [
  { res:'wood',  sellN:5, sellG:2, buyN:5, buyG:4 },
  { res:'stone', sellN:5, sellG:3, buyN:5, buyG:5 },
  { res:'iron',  sellN:3, sellG:4, buyN:3, buyG:6 },
  { res:'fiber', sellN:4, sellG:2, buyN:4, buyG:4 },
  { res:'food',  sellN:5, sellG:3, buyN:5, buyG:5 },
  { res:'meat',  sellN:3, sellG:3, buyN:0, buyG:0 },
  { res:'fish',  sellN:3, sellG:2, buyN:0, buyG:0 },
  { res:'guiso', sellN:1, sellG:2, buyN:0, buyG:0 },
  { res:'herb',  sellN:4, sellG:2, buyN:4, buyG:4 },
  { res:'medicina', sellN:1, sellG:4, buyN:1, buyG:6 },
  { res:'tools', sellN:1, sellG:4, buyN:1, buyG:7 },
  { res:'ropa',  sellN:1, sellG:3, buyN:1, buyG:5 },
];
const TRADER_LINES = ['¡Buenas! ¿Algo para comerciar?', '¡Precios justos, se los juro!',
  'Me voy al atardecer, apuren.', 'Lindo lugar armaron acá.', '¡Guisos! Compro guisos.',
  'El hierro está caro estos días.'];

const O_NAME = {
  tree:'🌳 Árbol', rock:'🪨 Roca', berry:'🫐 Arbusto de bayas', fiber:'🌿 Fibra silvestre',
  herb:'🌱 Hierba medicinal',
  wall:'🧱 Muro', door:'🚪 Puerta', bed:'🛏️ Cama', table:'🍽️ Mesa', fogata:'🔥 Fogata',
  fogon:'🍲 Fogón', taller:'⚒️ Taller', telar:'🧵 Telar', statue:'🗿 Estatua', farol:'🏮 Farol',
  desk:'📚 Escritorio', chair:'🪑 Silla', shelf:'🗄️ Estantería', chest:'🧰 Baúl',
  brazier:'♨️ Brasero', medbed:'🏥 Cama de enfermería', pier:'🎣 Muelle',
};

// perfiles de mundo: cada partida genera un lugar distinto
const BIOMES = [
  { id:'pradera',  name:'Pradera abierta',   lakes:3,  forests:22, rocks:14, berries:70, fiberP:35, river:false },
  { id:'bosque',   name:'Bosque profundo',   lakes:4,  forests:55, rocks:12, berries:45, fiberP:20, river:false },
  { id:'lagunas',  name:'Tierra de lagunas', lakes:11, forests:28, rocks:14, berries:50, fiberP:25, river:false },
  { id:'rio',      name:'Valle del río',     lakes:2,  forests:30, rocks:16, berries:55, fiberP:25, river:true },
  { id:'pedregal', name:'Pedregal ventoso',  lakes:3,  forests:18, rocks:30, berries:40, fiberP:30, river:false },
];
