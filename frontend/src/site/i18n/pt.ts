import type { Dict } from './en';

export const pt: Dict = {
  meta: {
    title: 'Meowgul — um universo de gatos dentro do Telegram',
    description:
      'Meowgul é um jogo dentro do Telegram: toque, colecione personagens, evolua sua conta e suba por dez ligas. Cresce junto com a comunidade.',
  },
  nav: {
    project: 'Projeto',
    gameplay: 'Jogabilidade',
    collection: 'Coleção',
    airdrop: 'Airdrop',
    roadmap: 'Roadmap',
    community: 'Comunidade',
    sections: 'Secções',
    menu: 'Menu',
    homeAria: 'Meowgul — início',
    language: 'Idioma',
  },
  cta: {
    play: 'Jogar',
    learn: 'Conheça o projeto',
    checkProgress: 'Ver meu progresso',
    partner: 'Seja parceiro',
  },
  social: {
    telegram: 'Telegram',
    x: 'X',
    community: 'Comunidade',
    soon: 'Em breve',
    main: 'Canal principal',
  },
  hero: {
    label: 'Mini App do Telegram',
    title: 'Entra no mundo de Meowgul',
    lead: 'Um jogo vivo no Telegram, onde cada toque, cada melhoria e cada descoberta te levam mais fundo num universo que não para de crescer.',
    scroll: 'Desliza',
  },
  project: {
    label: 'O projeto',
    title: 'Um mundo construído gato a gato',
    blocks: [
      {
        title: 'O que é',
        text: 'Um jogo dentro do Telegram. Abre com um toque, sem instalar nada: toque, evolua e colecione gatos com histórias próprias.',
      },
      {
        title: 'Por que existe',
        text: 'A maioria dos jogos de toque é uma tela e um número. Meowgul acrescenta o que faz você voltar: personagens, uma coleção e um progresso que dura.',
      },
      {
        title: 'O que o jogador ganha',
        text: 'Sessões curtas com progresso real: renda que cresce enquanto você está fora, recompensas diárias, ligas e personagens para colecionar.',
      },
      {
        title: 'Para onde vai',
        text: 'Mais personagens, eventos da comunidade e novos sistemas de jogo, passo a passo, conforme o mundo cresce.',
      },
    ],
    facts: [
      { value: '1 toque', label: 'para começar' },
      { value: '10', label: 'personagens' },
      { value: '50', label: 'níveis' },
      { value: '60', label: 'conquistas' },
    ],
  },
  gameplay: {
    label: 'Jogabilidade',
    title: 'Como funciona',
    lead: 'Um ciclo de cinco passos que, a cada dia, leva você um pouco mais longe.',
    loop: [
      {
        title: 'Jogue',
        text: 'Toque no gato para ganhar PAW.',
        detail: 'Cada toque gasta 1 de energia · 5.000 de energia, +3 por segundo',
      },
      {
        title: 'Colecione',
        text: 'Personagens, skins e efeitos de toque.',
        detail: 'A raridade muda a aparência, nunca a economia',
      },
      {
        title: 'Evolua',
        text: 'Melhore ativos, suba de nível e de liga.',
        detail: '59 ativos rendem a cada hora — offline também, até 3 h',
      },
      {
        title: 'Descubra',
        text: 'Combo diário, cifra Morse e tarefas.',
        detail: '60 conquistas para desbloquear pelo caminho',
      },
      {
        title: 'Volte',
        text: 'Uma sequência de recompensas e sua renda esperam por você.',
        detail: 'Sequência de 10 dias · tarefas novas todo dia',
      },
    ],
    boosts: [
      { title: 'Turbo', text: '×5 por toque durante 60 s, sem gastar energia · 3 por dia' },
      { title: 'Energia total', text: 'Recarrega ao máximo num instante · 6 por dia' },
    ],
    energy: 'Energia',
    turboOn: 'Turbo · sem energia',
    turbo: 'Turbo ×{x}',
    turboAria: 'Turbo: restam {left} de {total} hoje',
    demo: 'Experimente: toque no gato',
    tapHint: 'Toca no gato',
    noEnergy: 'Sem energia',
  },
  collection: {
    label: 'A coleção',
    title: 'Cada gato tem uma história',
    lead: 'De assassinos silenciosos a imperadores cósmicos — cada personagem tem seu mundo, sua raridade e sua história. Deslize, toque ou use as setas.',
    rarity: 'Raridade',
    type: 'Tipo',
    power: 'Poder',
    prev: 'Gato anterior',
    next: 'Gato seguinte',
    list: 'Gatos',
    tiers: 'Níveis de raridade',
    tierText: {
      COMMON: 'Onde começa qualquer coleção.',
      RARE: 'Visual marcante, mais difícil de encontrar.',
      EPIC: 'Personagens com mundos próprios.',
      LEGENDARY: 'Ícones do universo.',
      MYTHIC: 'Quase fora de alcance.',
    },
    note: 'A raridade tem a ver com o visual, não com poder na economia. Os efeitos de toque desbloqueiam-se ao subir de nível.',
    explore: 'Ver a coleção →',
  },
  rarity: { COMMON: 'Comum', RARE: 'Raro', EPIC: 'Épico', LEGENDARY: 'Lendário', MYTHIC: 'Mítico' },
  cats: {
    stealth_assassin: {
      name: 'Assassino Furtivo',
      subtitle: 'O caçador silencioso',
      world: 'Distrito Sombrio',
      story:
        'Um mestre da precisão e da paciência. Este gato lendário move-se nas sombras à espera do momento perfeito para atacar.',
      type: 'Assassino',
    },
    galaxy_emperor: {
      name: 'Imperador Galáctico',
      subtitle: 'O soberano para lá das estrelas',
      world: 'Fronteira Galáctica',
      story:
        'Um soberano cósmico envolto em energia ancestral. O seu poder vem de mundos muito para lá do universo conhecido.',
      type: 'Cósmico',
    },
    ocean_guardian: {
      name: 'Guardião do Oceano',
      subtitle: 'Guardião das profundezas',
      world: 'Reino do Oceano',
      story: 'Um guardião ancestral que protege os segredos escondidos sob as águas mais profundas.',
      type: 'Guardião',
    },
    cyber_samurai: {
      name: 'Ciber Samurai',
      subtitle: 'A lâmina de néon',
      world: 'Santuário de Néon',
      story: 'Um guerreiro forjado entre a tradição e a tecnologia. Rápido, preciso e impossível de prever.',
      type: 'Guerreiro',
    },
    inferno: {
      name: 'Inferno',
      subtitle: 'Guardião da última faísca',
      world: 'Grutas de Brasas',
      story: 'Nasceu no coração de um vulcão. Por onde passa, a pedra guarda o calor durante muito tempo.',
      type: 'Fogo',
    },
    toxic: {
      name: 'Tóxico',
      subtitle: 'Engenheiro de reatores',
      world: 'Fábrica de Néon',
      story: 'Repara os reatores de que mais ninguém se atreve a aproximar. Nem para dormir tira os óculos.',
      type: 'Engenheiro',
    },
    desert_nomad: {
      name: 'Nómada do Deserto',
      subtitle: 'Guia entre as tempestades',
      world: 'Cidadela de Areia',
      story:
        'Conhece todos os trilhos até à cidadela no horizonte. Os seus óculos lembram uma caravana que nunca abandonou.',
      type: 'Explorador',
    },
    sakura_blossom: {
      name: 'Sakura',
      subtitle: 'A voz do santuário em flor',
      world: 'Santuário das Cerejeiras',
      story:
        'Guardiã dos torii vermelhos. O vento traz-lhe pétalas de todos os jardins que ainda se lembram dela.',
      type: 'Espírito',
    },
    lunar_witch: {
      name: 'Bruxa Lunar',
      subtitle: 'Feitiços da lua cheia',
      world: 'Cidade ao Luar',
      story: 'Lança fogo violeta sobre os telhados da cidade antiga. O seu cajado lembra cem feitiços.',
      type: 'Místico',
    },
    crystal_prince: {
      name: 'Príncipe de Cristal',
      subtitle: 'Herdeiro da coroa enterrada',
      world: 'Ruínas de Ametista',
      story: 'O último da linhagem real. Nascem cristais onde quer que ele pare mais de um minuto.',
      type: 'Cristal',
    },
  },
  progress: {
    label: 'Progresso',
    title: 'Um motivo para voltar',
    lead: 'Sempre há algo esperando: a recompensa da sequência, tarefas novas, a renda dos seus ativos e a próxima liga.',
    daily: 'Recompensa diária · dia {day} de {total}',
    day: 'Dia {day}',
    dayAria: 'Dia {day}: {amount} PAW',
    claim: '{label} — receber',
    everyDay: 'Todos os dias',
    tasks: [
      { title: 'Combo diário', text: 'Encontra os três ativos do dia', reward: 'a partir de 50 000' },
      { title: 'Cifra diária', text: 'Toca a palavra do dia em código Morse', reward: 'a partir de 10 000' },
      { title: 'Convida amigos', text: 'Bónus para os dois · 25 000 com Premium', reward: '5 000' },
    ],
    leagues: 'Ligas',
    leaguesText: 'Pelo total de tudo o que você ganhou',
  },
  airdrop: {
    label: 'Airdrop',
    title: 'Sua jornada importa',
    lead: 'Os pontos do airdrop são todo o PAW que você ganhou. O progresso é registrado no jogo com base em seis requisitos claros.',
    pillars: [
      { title: 'Participação', text: 'Jogue com frequência e mantenha a sequência.' },
      { title: 'Progressão', text: 'Níveis, ligas e ativos melhorados.' },
      { title: 'Requisitos', text: 'Seis metas, cada uma com sua barra.' },
      { title: 'Comunidade', text: 'Os amigos que você traz também contam.' },
    ],
    progress: 'Progresso de exemplo',
    example: 'Jogador de demonstração',
    reqs: {
      league: 'Chega à liga Platinum',
      level: 'Alcança o nível 10',
      friends: 'Convida 3 amigos',
      streak: 'Sequência de 7 dias',
      cards: 'Desbloqueia 6 ativos',
      tasks: 'Completa 5 tarefas',
    },
    fine: 'Os detalhes da distribuição serão anunciados mais tarde. Nada aqui é promessa de renda ou recompensa; você não precisa de carteira para jogar.',
  },
  partners: {
    label: 'Parcerias',
    title: 'Construa com a gente',
    lead: 'Meowgul é um jogo nativo do Telegram, com personagens, hábitos diários e uma comunidade em crescimento — um lugar natural para marcas e projetos encontrarem jogadores.',
    offers: [
      {
        title: 'Público nativo do Telegram',
        text: 'Os jogadores abrem o jogo dentro do Telegram — sem instalação, sem atrito.',
      },
      {
        title: 'Um ecossistema de jogo',
        text: 'Personagens, coleção, ligas e tarefas diárias — muitos pontos de contato naturais.',
      },
      {
        title: 'Crescimento pela comunidade',
        text: 'Os jogadores trazem amigos: convites e metas compartilhadas fazem parte do jogo.',
      },
      {
        title: 'Eventos e desafios',
        text: 'Eventos especiais no jogo e desafios de marca criados com você.',
      },
      {
        title: 'Recompensas e colaborações',
        text: 'Recompensas, tarefas ou personagens em conjunto que os jogadores realmente querem.',
      },
      { title: 'Visibilidade', text: 'Presença em um lugar ao qual os jogadores voltam todos os dias.' },
    ],
    metrics: {
      users: 'Usuários ativos',
      community: 'Comunidade',
      retention: 'Retenção',
      countries: 'Países',
    },
    onRequest: 'Sob consulta',
    contact: 'As solicitações vão direto para a equipe.',
  },
  roadmap: {
    label: 'Roadmap',
    title: 'Para onde vamos',
    lead: 'O que já funciona está marcado. Todo o resto é plano e pode mudar conforme o mundo cresce.',
    states: { done: 'No ar', now: 'Em andamento', next: 'Próximo', later: 'Depois' },
    stages: [
      { title: 'Fundação', items: ['Mini App no Telegram', 'Jogo principal', 'Economia do jogo'] },
      {
        title: 'Jogabilidade',
        items: ['Energia e boosts', '59 ativos evoluíveis', 'Tarefas diárias e cifra', 'Níveis e ligas'],
      },
      { title: 'Coleção', items: ['Personagens e skins', 'Efeitos de toque', 'Novos personagens'] },
      {
        title: 'Comunidade',
        items: ['Eventos da comunidade', 'Mecânicas competitivas', 'Colaborações com parceiros'],
      },
      {
        title: 'Expansão',
        items: ['Novos sistemas de jogo', 'Novas histórias', 'Um universo em crescimento'],
      },
    ],
  },
  community: {
    label: 'Comunidade',
    title: 'O mundo é melhor em conjunto',
    lead: 'O Telegram é a nossa casa: notícias, atualizações e novos personagens chegam lá primeiro.',
    faq: 'Perguntas frequentes',
    items: [
      {
        q: 'O que é Meowgul?',
        a: 'Um jogo dentro do Telegram sobre gatos, coleção e progresso de longo prazo, que cresce junto com a comunidade.',
      },
      {
        q: 'Como começo a jogar?',
        a: 'Toque em “Jogar” — o Mini App abre direto no Telegram. Sem download, sem cadastro.',
      },
      {
        q: 'Onde fica o jogo?',
        a: 'Dentro do Telegram, como Mini App do nosso bot. Funciona no celular e no computador.',
      },
      {
        q: 'Como ganho recompensas?',
        a: 'Toque, melhore ativos para ter renda por hora, mantenha a sequência diária, resolva o combo e a cifra, complete tarefas e convide amigos.',
      },
      {
        q: 'O que é o airdrop?',
        a: 'Os pontos do airdrop são o PAW que você ganha; o jogo mostra seis requisitos e o seu progresso. Os detalhes da distribuição serão anunciados — nada é garantido.',
      },
      {
        q: 'Como desbloqueio novos personagens?',
        a: 'Personagens e skins ficam na Coleção dentro do jogo; os novos chegam com as atualizações. Os efeitos de toque são liberados com o seu nível.',
      },
      {
        q: 'Como me torno parceiro?',
        a: 'Toque em “Seja parceiro” — a solicitação vai direto para a equipe.',
      },
    ],
  },
  footer: {
    about: 'Um jogo no Telegram sobre gatos, colecionismo e um universo em crescimento.',
    slogan: 'A história está só começando.',
    navigate: 'Navegação',
    connect: 'Comunidade',
    partnership: 'Parcerias',
    fine: 'Os PAW e os ativos do jogo são itens do jogo: não podem ser levantados, vendidos nem transferidos.',
    nav: 'Rodapé',
  },
};
