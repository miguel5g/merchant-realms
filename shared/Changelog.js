/* ============================================================
   Changelog.js — Histórico de versões e alterações do jogo
   Compatível com Node.js (CommonJS) e navegador (root.Game)
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const CHANGELOG = [
    {
      version: 'v0.5.0',
      date: '07 de Setembro de 2026',
      title: 'Blueprints e Estruturas Geradoras',
      current: true,
      items: [
        {
          type: 'novo',
          title: 'Categoria Blueprints na Fabricação',
          desc: 'Nova aba Blueprints ao lado de Básico, Metais e Construção. Blueprints são comprados apenas com coroas e não consomem nenhum material: o painel de detalhes troca a lista de materiais por custo em coroas, produção da estrutura e estoque máximo, e o botão passa a ser "Comprar ×1". A contagem ×N na lista mostra quantos o jogador consegue pagar com as coroas que tem.'
        },
        {
          type: 'novo',
          title: 'Madeireira: primeira estrutura geradora',
          desc: 'Blueprint da Madeireira por 120 coroas, de uso único: ao ser colocada no mundo (botão esquerdo), o blueprint é consumido e vira uma estrutura fixa que produz 1 madeira a cada 15 segundos, acumulando até 24 unidades. O recurso fica guardado na estrutura até ser recolhido (segure o botão direito, como em qualquer recurso) e, diferente de árvores e rochas, ela não é destruída ao esvaziar: continua de pé e volta a produzir. A produção é salva no mundo e retomada quando o servidor reinicia.'
        },
        {
          type: 'melhoria',
          title: 'Painel de Inspeção Reconhece Estruturas Geradoras',
          desc: 'Ao mirar uma madeireira, o painel abaixo do minimapa mostra taxa de produção, estoque atual sobre o máximo, barra de progresso e o aviso "produzindo — nada para recolher ainda" quando ela está vazia. O realce amarelo do cursor não aparece mais sobre uma estrutura sem estoque.'
        },
        {
          type: 'melhoria',
          title: 'Bancada de Trabalho Removida do Jogo',
          desc: 'A bancada de trabalho foi removida por completo: receita, item de inventário, entidade colocável, arte no mundo/minimapa e a única instância que existia no mapa. A fabricação nunca exigiu estação — nenhuma outra receita tinha a bancada como pré-requisito — e agora isso está explícito na interface ("na mão · sem estação"). Mundos salvos antes da mudança descartam a bancada ao carregar e o terreno original volta no lugar.'
        },
        {
          type: 'correcao',
          title: 'Coleta Travada com Estoque Defasado no Cliente',
          desc: 'A coleta dependia do estoque em cache no cliente: se o navegador perdesse as atualizações da estrutura (página aberta durante um reinício do servidor, pacote não aplicado, sessão antiga), ele achava que a madeireira estava vazia e bloqueava o envio da coleta, sem nenhuma mensagem de erro. Agora o servidor é a autoridade sobre o estoque — o cliente tenta recolher uma vez por segundo mesmo achando que está vazio, e o servidor devolve o estado real do tile quando a coleta não rende nada, então o cliente se corrige sozinho.'
        },
        {
          type: 'correcao',
          title: 'Janelas de Troca e Fabricação com Conteúdo Vazando',
          desc: 'Na troca, o grid do inventário tinha largura fixa maior que a coluna que o continha e gerava rolagem horizontal e vertical; agora os slots são elásticos e as 4 linhas aparecem inteiras, de 900×560 até 1920×1080. Na fabricação, o painel de detalhes de um blueprint escorria para fora da borda (dica de Shift+clique, total de coroas e linha "Uso · único"); o conteúdo passou a ficar contido, com os botões Comprar/×10 fixos no rodapé. As duas janelas ficaram um pouco maiores, as abas de categoria quebram linha quando não cabem e nomes longos de receita quebram em duas linhas em vez de serem cortados.'
        }
      ]
    },
    {
      version: 'v0.4.0',
      date: '07 de Setembro de 2026',
      title: 'Controles e Interação com o Mundo',
      items: [
        {
          type: 'melhoria',
          title: 'Inversão dos Botões de Interação',
          desc: 'Botão esquerdo agora coloca itens de construção selecionados na hotbar (muros, baús e bancadas). Botão direito quebra blocos e extrai recursos sob o cursor (árvores, rochas, minérios e construções), independente do item selecionado.'
        },
        {
          type: 'melhoria',
          title: 'Validação Completa de Posicionamento',
          desc: 'Checagem rigorosa de alcance (3 tiles), terreno desobstruído e sobreposição com caixas de colisão de jogadores (evitando prendê-los dentro de estruturas). O consumo de item no inventário ocorre apenas após aprovação de todas as validações.'
        },
        {
          type: 'novo',
          title: 'Painel Fixo de Inspeção de Recursos',
          desc: 'Substituição do tooltip flutuante por um painel elegante fixado abaixo do minimapa, exibindo ícone pixel art, rendimento, tempo de extração, ferramenta recomendada, barra de progresso visual e alertas contextuais limpos.'
        },
        {
          type: 'melhoria',
          title: 'Lista de Fabricação (Craft) Enxuta',
          desc: 'Listagem de receitas simplificada exibindo apenas o nome e quantidade máxima fabricável (×N). Materiais necessários e botões de fabricação agora residem de forma limpa no painel de detalhes dinâmico.'
        },
        {
          type: 'melhoria',
          title: 'Atualização de Instruções e Indicadores Visuais',
          desc: 'Hotbar (#hb-label), janela de controles [Esc], tooltips e documentação atualizados para refletir o novo padrão de botões, com supressão inteligente do realce amarelo quando a mira sobrepõe o jogador.'
        }
      ]
    },
    {
      version: 'v0.3.0',
      date: '07 de Setembro de 2026',
      title: 'Sistema de Perfil, Conquistas e Economia',
      items: [
        {
          type: 'melhoria',
          title: 'Tooltips Simples nos Inventários',
          desc: 'Ao passar o mouse sobre qualquer item nos slots de inventário, atalhos, equipamentos ou trocas, um tooltip claro e limpo exibe o nome do item e sua durabilidade.'
        },
        {
          type: 'novo',
          title: 'Tela de Changelog Integrada',
          desc: 'Adicionada interface para acompanhar todas as notas de atualização do jogo pelo menu ou pressionando [C].'
        },
        {
          type: 'novo',
          title: 'Sistema de Perfil e Conquistas',
          desc: 'Acompanhe seu nível, horas jogadas, recursos minerados, blocos colocados e desbloqueie 11 conquistas com títulos exclusivos.'
        },
        {
          type: 'novo',
          title: 'Reputação Comercial e Parceiros Frequentes',
          desc: 'Registro de trocas concluídas, cancelamentos e índice de confiabilidade entre negociantes.'
        },
        {
          type: 'novo',
          title: 'Customização de Cores do Personagem',
          desc: 'Escolha a cor do seu personagem na paleta disponível diretamente na tela de perfil [P].'
        },
        {
          type: 'melhoria',
          title: 'Regras de Nomes no Multiplayer e Chat Privado',
          desc: 'Restrição de caracteres para nomes de jogadores (2 a 16 caracteres, sem espaços, apenas letras, números, _ ou -), garantindo o funcionamento perfeito do comando de sussurro /w.'
        },
        {
          type: 'melhoria',
          title: 'Minimapa com Marcadores de Jogadores',
          desc: 'O minimapa agora exibe outros jogadores com suas respectivas cores em tempo real.'
        },
        {
          type: 'balanceamento',
          title: 'Recompensa Diária de Moedas',
          desc: 'Cada jogador online recebe 10 coroas a cada novo amanhecer no mundo.'
        }
      ]
    },
    {
      version: 'v0.2.0',
      date: '05 de Setembro de 2026',
      title: 'Multiplayer, Comércio e Fabricação',
      items: [
        {
          type: 'novo',
          title: 'Sistema de Comércio Seguro (P2P)',
          desc: 'Negocie itens e moedas com jogadores próximos (até 5 tiles) com interface de confirmação dupla.'
        },
        {
          type: 'novo',
          title: 'Chat Dividido em Canais',
          desc: 'Comunicação organizada em Global, Local (raio de 20 tiles), Comércio e Sussurro privativo (/w).'
        },
        {
          type: 'novo',
          title: 'Sistema de Perícias (Skills)',
          desc: 'Evolua perícias de Mineração, Lenhador, Construção, Comércio e Exploração conforme joga.'
        },
        {
          type: 'novo',
          title: 'Novos Itens e Construções',
          desc: 'Criação de baús, bancadas de trabalho, muros de pedra e placas metálicas.'
        },
        {
          type: 'melhoria',
          title: 'Ciclo Dia e Noite com Iluminação Dinâmica',
          desc: 'Duração de 10 minutos por dia de jogo, transição suave de iluminação e relógio no HUD.'
        },
        {
          type: 'correcao',
          title: 'Sincronização de Chunks e Posição',
          desc: 'Interpolação de movimento de outros jogadores para eliminar saltos visuais.'
        }
      ]
    },
    {
      version: 'v0.1.0',
      date: '01 de Setembro de 2026',
      title: 'Fundação do Protótipo & Mundo Procedural',
      items: [
        {
          type: 'novo',
          title: 'Geração Procedural com Ruído Perlin',
          desc: 'Mundo infinito dividido em chunks com biomas de água, areia, grama e depósitos de pedra.'
        },
        {
          type: 'novo',
          title: 'Mineração e Coleta de Recursos',
          desc: 'Extração de madeira em árvores e minérios de pedra, ferro e cobre com tempo de extração.'
        },
        {
          type: 'novo',
          title: 'Inventário e Hotbar',
          desc: '32 slots de inventário com 8 slots de acesso rápido (hotbar) e suporte a divisão de pilhas.'
        },
        {
          type: 'novo',
          title: 'Servidor WebSocket e Multi-instância',
          desc: 'Arquitetura Fastify com suporte a múltiplos servidores via lista PEERS e persistência automática.'
        }
      ]
    }
  ];

  return {
    CHANGELOG
  };
});
