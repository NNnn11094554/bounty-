import type { Dict } from './en';

export const es: Dict = {
  meta: {
    title: 'Meowgul — un universo de gatos dentro de Telegram',
    description:
      'Meowgul es un juego dentro de Telegram: toca, colecciona personajes, haz crecer tu cuenta y sube por diez ligas. Crece junto a su comunidad.',
  },
  nav: {
    project: 'Proyecto',
    gameplay: 'Jugabilidad',
    collection: 'Colección',
    airdrop: 'Airdrop',
    roadmap: 'Hoja de ruta',
    community: 'Comunidad',
    sections: 'Secciones',
    menu: 'Menú',
    homeAria: 'Meowgul — inicio',
    language: 'Idioma',
  },
  cta: {
    play: 'Jugar',
    learn: 'Conoce el proyecto',
    checkProgress: 'Ver mi progreso',
    partner: 'Hazte socio',
  },
  social: { telegram: 'Telegram', x: 'X', community: 'Comunidad', soon: 'Pronto', main: 'Canal principal' },
  hero: {
    label: 'Mini App de Telegram',
    title: 'Entra en el mundo de Meowgul',
    lead: 'Un juego vivo en Telegram donde cada toque, cada mejora y cada descubrimiento te llevan más adentro de un universo que no deja de crecer.',
    scroll: 'Desliza',
  },
  project: {
    label: 'El proyecto',
    title: 'Un mundo construido gato a gato',
    blocks: [
      {
        title: 'Qué es',
        text: 'Un juego dentro de Telegram. Se abre con un toque, sin instalar nada: toca, progresa y colecciona gatos con historia propia.',
      },
      {
        title: 'Por qué existe',
        text: 'La mayoría de los juegos de toques son una pantalla y un número. Meowgul añade lo que te hace volver: personajes, una colección y un progreso que perdura.',
      },
      {
        title: 'Qué obtiene el jugador',
        text: 'Sesiones cortas con progreso real: ingresos que crecen mientras no estás, recompensas diarias, ligas y personajes para coleccionar.',
      },
      {
        title: 'Hacia dónde va',
        text: 'Más personajes, eventos de la comunidad y nuevos sistemas de juego, paso a paso, a medida que el mundo crece.',
      },
    ],
    facts: [
      { value: '1 toque', label: 'para empezar' },
      { value: '10', label: 'personajes' },
      { value: '50', label: 'niveles' },
      { value: '60', label: 'logros' },
    ],
  },
  gameplay: {
    label: 'Jugabilidad',
    title: 'Cómo funciona',
    lead: 'Un ciclo de cinco pasos que cada día te lleva un poco más lejos.',
    loop: [
      {
        title: 'Juega',
        text: 'Toca al gato para ganar PAW.',
        detail: 'Cada toque gasta 1 de energía · 5.000 de energía, +3 por segundo',
      },
      {
        title: 'Colecciona',
        text: 'Personajes, skins y efectos de toque.',
        detail: 'La rareza cambia el aspecto, nunca la economía',
      },
      {
        title: 'Progresa',
        text: 'Mejora activos, sube de nivel y de liga.',
        detail: '59 activos generan cada hora, también sin conexión, hasta 3 h',
      },
      {
        title: 'Descubre',
        text: 'Combo diario, cifrado Morse y tareas.',
        detail: '60 logros por desbloquear en el camino',
      },
      {
        title: 'Vuelve',
        text: 'Te esperan una racha de recompensas y tus ingresos.',
        detail: 'Racha de 10 días · tareas nuevas cada día',
      },
    ],
    boosts: [
      { title: 'Turbo', text: '×5 por toque durante 60 s, sin gastar energía · 3 al día' },
      { title: 'Energía completa', text: 'Recarga al máximo al instante · 6 al día' },
    ],
    energy: 'Energía',
    turboOn: 'Turbo · sin energía',
    turbo: 'Turbo ×{x}',
    turboAria: 'Turbo: te quedan {left} de {total} hoy',
    demo: 'Pruébalo: toca al gato',
    tapHint: 'Toca al gato',
    noEnergy: 'Sin energía',
  },
  collection: {
    label: 'La colección',
    title: 'Cada gato tiene una historia',
    lead: 'De asesinos silenciosos a emperadores cósmicos: cada personaje tiene su mundo, su rareza y su historia. Desliza, toca o usa las flechas.',
    rarity: 'Rareza',
    type: 'Tipo',
    power: 'Poder',
    prev: 'Gato anterior',
    next: 'Gato siguiente',
    list: 'Gatos',
    tiers: 'Niveles de rareza',
    tierText: {
      COMMON: 'Donde empieza toda colección.',
      RARE: 'Aspecto distintivo, más difícil de encontrar.',
      EPIC: 'Personajes con mundos propios.',
      LEGENDARY: 'Iconos del universo.',
      MYTHIC: 'Casi fuera de alcance.',
    },
    note: 'La rareza es cuestión de aspecto, no de poder en la economía. Los efectos de toque se desbloquean al subir de nivel.',
    explore: 'Ver la colección →',
  },
  rarity: { COMMON: 'Común', RARE: 'Raro', EPIC: 'Épico', LEGENDARY: 'Legendario', MYTHIC: 'Mítico' },
  cats: {
    stealth_assassin: {
      name: 'Asesino Sigiloso',
      subtitle: 'El cazador silencioso',
      world: 'Distrito Sombrío',
      story:
        'Un maestro de la precisión y la paciencia. Este gato legendario se mueve entre las sombras a la espera del momento perfecto para atacar.',
      type: 'Asesino',
    },
    galaxy_emperor: {
      name: 'Emperador Galáctico',
      subtitle: 'El soberano más allá de las estrellas',
      world: 'Frontera Galáctica',
      story:
        'Un soberano cósmico rodeado de energía ancestral. Su poder procede de mundos mucho más allá del universo conocido.',
      type: 'Cósmico',
    },
    ocean_guardian: {
      name: 'Guardián del Océano',
      subtitle: 'Custodio de las profundidades',
      world: 'Reino Oceánico',
      story: 'Un guardián ancestral que protege los secretos ocultos bajo las aguas más profundas.',
      type: 'Guardián',
    },
    cyber_samurai: {
      name: 'Ciber Samurái',
      subtitle: 'La hoja de neón',
      world: 'Santuario de Neón',
      story:
        'Un guerrero forjado entre la tradición y la tecnología. Rápido, preciso e imposible de predecir.',
      type: 'Guerrero',
    },
    inferno: {
      name: 'Inferno',
      subtitle: 'Guardián de la última chispa',
      world: 'Cuevas de Brasas',
      story:
        'Nació en el corazón de un volcán. Por donde pasa, la piedra conserva el calor durante mucho tiempo.',
      type: 'Fuego',
    },
    toxic: {
      name: 'Tóxico',
      subtitle: 'Ingeniero de reactores',
      world: 'Planta de Neón',
      story:
        'Repara los reactores a los que nadie más se atreve a acercarse. No se quita las gafas ni para dormir.',
      type: 'Ingeniero',
    },
    desert_nomad: {
      name: 'Nómada del Desierto',
      subtitle: 'Guía entre las tormentas',
      world: 'Ciudadela de Arena',
      story:
        'Conoce cada senda hacia la ciudadela del horizonte. Sus gafas recuerdan una caravana que nunca abandonó.',
      type: 'Explorador',
    },
    sakura_blossom: {
      name: 'Sakura',
      subtitle: 'La voz del santuario en flor',
      world: 'Santuario de los Cerezos',
      story:
        'Guardiana de los torii rojos. El viento le trae pétalos de todos los jardines que aún la recuerdan.',
      type: 'Espíritu',
    },
    lunar_witch: {
      name: 'Bruja Lunar',
      subtitle: 'Hechizos de luna llena',
      world: 'Ciudad de la Luna',
      story: 'Lanza fuego violeta sobre los tejados de la ciudad antigua. Su bastón recuerda cien hechizos.',
      type: 'Místico',
    },
    crystal_prince: {
      name: 'Príncipe de Cristal',
      subtitle: 'Heredero de la corona enterrada',
      world: 'Ruinas de Amatista',
      story: 'El último de la estirpe real. Brotan cristales allí donde se detiene más de un minuto.',
      type: 'Cristal',
    },
  },
  progress: {
    label: 'Progreso',
    title: 'Un motivo para volver',
    lead: 'Siempre hay algo esperándote: la recompensa de tu racha, tareas nuevas, ingresos de tus activos y la siguiente liga.',
    daily: 'Recompensa diaria · día {day} de {total}',
    day: 'Día {day}',
    dayAria: 'Día {day}: {amount} PAW',
    claim: '{label} — reclamar',
    everyDay: 'Cada día',
    tasks: [
      { title: 'Combo diario', text: 'Encuentra los tres activos del día', reward: 'desde 50.000' },
      { title: 'Cifrado diario', text: 'Teclea la palabra del día en código Morse', reward: 'desde 10.000' },
      { title: 'Invita a amigos', text: 'Bonificación para los dos · 25.000 con Premium', reward: '5.000' },
    ],
    leagues: 'Ligas',
    leaguesText: 'Según todo lo que has ganado',
    stats: [
      { value: '10', label: 'ligas' },
      { value: '50', label: 'niveles' },
      { value: '60', label: 'logros' },
      { value: '3 h', label: 'de ingresos sin conexión' },
    ],
  },
  airdrop: {
    label: 'Airdrop',
    title: 'Tu camino importa',
    lead: 'Los puntos del airdrop son todo el PAW que has ganado. El progreso se registra en el juego según seis requisitos claros.',
    pillars: [
      { title: 'Participación', text: 'Juega con regularidad y mantén tu racha.' },
      { title: 'Progresión', text: 'Niveles, ligas y activos mejorados.' },
      { title: 'Requisitos', text: 'Seis objetivos, cada uno con su barra.' },
      { title: 'Comunidad', text: 'Los amigos que traes también cuentan.' },
    ],
    progress: 'Progreso de ejemplo',
    example: 'Jugador de demostración',
    reqs: {
      league: 'Llega a la liga Platinum',
      level: 'Alcanza el nivel 10',
      friends: 'Invita a 3 amigos',
      streak: 'Racha de 7 días',
      cards: 'Desbloquea 6 activos',
      tasks: 'Completa 5 tareas',
    },
    fine: 'Los detalles de la distribución se anunciarán más adelante. Nada de lo que aparece aquí es una promesa de ingresos o recompensas; no necesitas cartera para jugar.',
  },
  partners: {
    label: 'Colaboraciones',
    title: 'Construye con nosotros',
    lead: 'Meowgul es un juego nativo de Telegram, con personajes, hábitos diarios y una comunidad en crecimiento: un lugar natural para que marcas y proyectos conozcan a los jugadores.',
    offers: [
      {
        title: 'Audiencia nativa de Telegram',
        text: 'Los jugadores abren el juego dentro de Telegram, sin instalaciones ni fricción.',
      },
      {
        title: 'Un ecosistema de juego',
        text: 'Personajes, colección, ligas y tareas diarias: muchos puntos de contacto naturales.',
      },
      {
        title: 'Crecimiento impulsado por la comunidad',
        text: 'Los jugadores traen amigos: las invitaciones y los objetivos compartidos forman parte del juego.',
      },
      {
        title: 'Eventos y desafíos',
        text: 'Eventos especiales dentro del juego y desafíos de marca creados contigo.',
      },
      {
        title: 'Recompensas y colaboraciones',
        text: 'Recompensas, tareas o personajes conjuntos que los jugadores realmente quieren.',
      },
      { title: 'Visibilidad', text: 'Presencia en un lugar al que los jugadores vuelven cada día.' },
    ],
    metrics: {
      users: 'Usuarios activos',
      community: 'Comunidad',
      retention: 'Retención',
      countries: 'Países',
    },
    onRequest: 'Bajo petición',
    contact: 'Las solicitudes llegan directamente al equipo.',
  },
  roadmap: {
    label: 'Hoja de ruta',
    title: 'Hacia dónde vamos',
    lead: 'Lo que ya funciona está marcado. Todo lo demás es un plan y puede cambiar a medida que el mundo crece.',
    states: { done: 'Activo', now: 'En curso', next: 'Siguiente', later: 'Más adelante' },
    stages: [
      { title: 'Base', items: ['Mini App de Telegram', 'Juego principal', 'Economía del juego'] },
      {
        title: 'Jugabilidad',
        items: [
          'Energía y potenciadores',
          '59 activos mejorables',
          'Tareas diarias y cifrado',
          'Niveles y ligas',
        ],
      },
      { title: 'Colección', items: ['Personajes y skins', 'Efectos de toque', 'Nuevos personajes'] },
      {
        title: 'Comunidad',
        items: ['Eventos de la comunidad', 'Mecánicas competitivas', 'Colaboraciones con socios'],
      },
      {
        title: 'Expansión',
        items: ['Nuevos sistemas de juego', 'Nuevas historias', 'Un universo en crecimiento'],
      },
    ],
  },
  community: {
    label: 'Comunidad',
    title: 'El mundo es mejor en compañía',
    lead: 'Telegram es nuestra casa: las noticias, las actualizaciones y los nuevos personajes llegan allí primero.',
    faq: 'Preguntas frecuentes',
    items: [
      {
        q: '¿Qué es Meowgul?',
        a: 'Un juego dentro de Telegram sobre gatos, coleccionismo y progreso a largo plazo, que crece junto a su comunidad.',
      },
      {
        q: '¿Cómo empiezo a jugar?',
        a: 'Pulsa «Jugar»: la Mini App se abre directamente en Telegram. Sin descargas ni registro.',
      },
      {
        q: '¿Dónde está el juego?',
        a: 'Dentro de Telegram, como Mini App de nuestro bot. Funciona en el móvil y en el ordenador.',
      },
      {
        q: '¿Cómo consigo recompensas?',
        a: 'Toca, mejora activos para obtener ingresos por hora, mantén tu racha diaria, resuelve el combo y el cifrado, completa tareas e invita a amigos.',
      },
      {
        q: '¿Qué es el airdrop?',
        a: 'Los puntos del airdrop son el PAW que ganas; el juego muestra seis requisitos y tu progreso. Los detalles de la distribución se anunciarán: nada está garantizado.',
      },
      {
        q: '¿Cómo desbloqueo nuevos personajes?',
        a: 'Los personajes y las skins están en la Colección dentro del juego; los nuevos llegan con las actualizaciones. Los efectos de toque se desbloquean con tu nivel.',
      },
      { q: '¿Cómo puedo ser socio?', a: 'Pulsa «Hazte socio»: tu solicitud llega directamente al equipo.' },
    ],
  },
  footer: {
    about: 'Un juego de Telegram sobre gatos, coleccionismo y un universo en crecimiento.',
    slogan: 'La historia acaba de empezar.',
    navigate: 'Navegación',
    connect: 'Comunidad',
    partnership: 'Colaboraciones',
    fine: 'Los PAW y los activos del juego son objetos del juego: no se pueden retirar, vender ni transferir.',
    nav: 'Pie de página',
  },
};
