const GameTemplate = require("../../lib/templates/gametemplate");

class Pandemic extends GameTemplate {

//////////////////
// CONSTRUCTOR  //
//////////////////
  constructor(app) {
    super(app);

    this.name = "Pandemic";
    this.gamename = "Pandemic";
    this.description = `Pandemic is a cooperative multiplayer board game in which players work together to try and fend off a global epidemic.`;
    this.categories = "Arcade Games Entertainment";
    this.maxPlayers = 4;
    this.minPlayers = 2;
    this.type = "Cooperative Boardgme";
    this.status = "Alpha";

    this.boardWidth = 2602;
    this.card_height_ratio = 1.41;
    this.outbreaks = [];
    this.maxHandSize = 7;

    this.active_moves = 0; // player active moves
    this.interface = 1; // default to graphics (as opposed to text interface)

    this.hud.mode = 0;
    this.hud.card_width = 120;
    this.hud.enable_mode_change = 1;
    let temp_self = this;
    this.menu_backup_callback = function(){temp_self.playerMakeMove();};
    this.changeable_callback = function(){};
    this.defaultDeck = 1;
    this.quarantine = "";

    return this;
  }

  respondTo(type) {
    if (super.respondTo(type) != null) {
      return super.respondTo(type);
    }

    if (type == "arcade-carousel") {
      let obj = {};
      obj.background = "/pandemic/web/img/arcade.jpg";
      obj.title = "Pandemic";
      return obj;
    }

    if (type == "arcade-create-game") {
      return {
        slug: this.slug,
        title: this.name,
        description: this.description,
        publisher_message: this.publisher_message,
        returnGameOptionsHTML: this.returnGameOptionsHTML.bind(this),
        minPlayers: this.minPlayers,
        maxPlayers: this.maxPlayers,
      };
    }

    return null;
  }

  showPlayerCards(player_num) {
    let html = "";
    let playerHand = this.game.players_info[player_num - 1].cards;

    for (let i = 0; i < playerHand.length; i++) {
      let card = this.returnCardImage(playerHand[i], 1).replace("img", `img id="${playerHand[i]}"`);
      html += card; //this.returnCardImage(playerHand[i], 1);
      //html += `<div class="card" id="${playerHand[i]}">${}</div>`;
    }
    html = html.replace(/cardimg/g,"card");
    this.overlay.show(this.app, this, `<div class="cardfan bighand">${html}</div>`);
    this.attachCardboxEvents(); //Don't do anything on click
  }

  ////////////////
  // initialize //
  ////////////////
  initializeGame(game_id) {
 
    this.loadGame(game_id);
    this.restoreLog(); //from gameTemplate

    //
    // new state if needed
    //
    if (this.game.dice == "") {
      this.initializeDice();
    }

    if (this.game.cities == undefined) {
      this.game.cities = this.returnCities();
      this.game.state = this.returnState();
      this.game.players_info = this.returnPlayers(this.game.players.length);

      //
      // start game once here
      //
      this.game.queue = [];
      this.game.queue.push("round");

      this.game.queue.push("initialize_player_deck");
      
      // Deal Player Cards
      // 2 P => 4 cards each, 3 P => 3 cards each, 4 P => 2 cards each
      let cards_to_deal = 6 - this.game.players.length;
      
      for (let i = 1; i <= this.game.players.length; i++) {
        this.game.queue.push(`draw_player_card\t${i}\t${cards_to_deal}`);
      }

      this.game.queue.push("place_initial_infection");


      this.game.queue.push("READY\t1");
      this.game.queue.push("SHUFFLE\t2");
      this.game.queue.push("DECK\t2\t" + JSON.stringify(this.returnPlayerCards()));
      this.game.queue.push("SHUFFLE\t1");
      this.game.queue.push("DECK\t1\t" + JSON.stringify(this.returnInfectionCards())
      );
    }
    
    //
    // if the browser is active, shift to the game that way
    //
    if (this.browser_active == 1) {
      //If one of the player's is a quarantine specialist, save that info!
      for (let player of this.game.players_info){
        if (player.type == 5){
          this.quarantine = player.city;
        }
      }      
          
      // Position city divs on the game board
      for (var i in this.game.cities) {
        let divname = "#" + i;

        try {
          $(divname).css("top", this.scale(this.game.cities[i].top) + "px");
          $(divname).css("left", this.scale(this.game.cities[i].left) + "px");
        } catch (err) {}
      }

      this.showBoard();
    
      this.handleGameLoop();
    }
  }

  initializeHTML(app) {
      
    if (!this.browser_active) { return; } 
    
    let pandemic_self = this;

    super.initializeHTML(app);

    this.app.modules.respondTo("chat-manager").forEach((mod) => {
      mod.respondTo("chat-manager").render(app, this);
      mod.respondTo("chat-manager").attachEvents(app, this);
    });

    this.menu.addMenuOption({
      text: "Game",
      id: "game-game",
      class: "game-game",
      callback: function (app, game_mod) {
        game_mod.menu.showSubMenu("game-game");
      },
    });
    this.menu.addSubMenuOption("game-game", {
      text: "Welcome",
      id: "game-welcome",
      class: "game-welcome",
      callback: function (app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.overlay.show(
          game_mod.app,
          game_mod,
          game_mod.returnWelcomeOverlay()
        );
        document.querySelector(".close_welcome_overlay").onclick = (e) => {
          game_mod.overlay.hide();
        };
      },
    });
    this.menu.addSubMenuOption("game-game", {
      text: "Log",
      id: "game-log",
      class: "game-log",
      callback: function (app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.log.toggleLog();
      },
    });
    this.menu.addSubMenuOption("game-game", {
      text: "Exit",
      id: "game-exit",
      class: "game-exit",
      callback: function (app, game_mod) {
        window.location.href = "/arcade";
      },
    });
    this.menu.addMenuOption({
      text: "Cards",
      id: "game-cards",
      class: "game-cards",
      callback: function (app, game_mod) {
        game_mod.menu.showSubMenu("game-cards");
      },
    });
    for (let i = 0; i < this.game.players.length; i++) {
      this.menu.addSubMenuOption("game-cards", {
        text: "Player " + (i + 1),
        id: "game-player-cards-" + (i + 1),
        class: "game-player-cards-" + (i + 1),
        callback: function (app, game_mod) {
          game_mod.menu.hideSubMenus();
          game_mod.showPlayerCards(i + 1);
        },
      });
    }

    this.menu.addMenuIcon({
      text: '<i class="fa fa-window-maximize" aria-hidden="true"></i>',
      id: "game-menu-fullscreen",
      callback: function (app, game_mod) {
        game_mod.menu.hideSubMenus();
        app.browser.requestFullscreen();
      },
    });

    this.menu.addChatMenu(app, this);
    
    this.menu.render(app, this);
    this.menu.attachEvents(app, this);

    this.log.render(app, this);
    this.log.attachEvents(app, this);

    this.cardbox.render(app, this);
    this.cardbox.attachEvents(app, this);
    
    this.cardbox.addCardType("showcard","",null);
    this.cardbox.addCardType("card", "select", this.cardbox_callback);
    this.attachCardboxEvents(); //Add hover action to restored Log tags and set this.cardbox_callback to dummy function

    this.hud.render(app, this);
    this.hud.attachEvents(app, this);

    if (this.game.players_info){
      let hh = document.querySelector(".hud-header");
      let role = this.game.players_info[this.game.player-1].role;
      role = role.split(" ")[0].toLowerCase();
      hh.classList.add(role);
    }

    try {
      if (app.browser.isMobileBrowser(navigator.userAgent)) {
        this.hud.card_width = 120; //Smaller cards
        this.cardbox.skip_card_prompt = 0;
        this.hammer.render(this.app, this);
        this.hammer.attachEvents(this.app, this, ".gameboard");
      } else {
        this.cardbox.skip_card_prompt = 1; //no Confirming
        this.sizer.render(this.app, this);
        this.sizer.attachEvents(this.app, this, ".gameboard");

      }
    } catch (err) {
      console.log("ERROR with Sizing: " + err);
    }

    this.definePlayersPawns();
  }

  playerTurn() {
    //Reset number of actions for the player (Generalist = 5, otherwise 4)
    this.active_moves = this.game.players_info[this.game.player-1].moves;
    // reset events
    this.game.state.one_quiet_night = 0;
    this.playerMakeMove();
  }

  playerDiscardCards() {
    let pandemic_self = this;
 
    if (pandemic_self.game.players_info[pandemic_self.game.player - 1].cards.length > pandemic_self.maxHandSize) {
      this.updateStatusAndListCards("Pick a card to discard: ",  this.game.players_info[this.game.player - 1].cards);
      $(".card").off();
      $(".card").on("click", async function () {
        let cid = $(this).attr("id");
        if (cid.indexOf("event") > -1) {
          let c = await sconfirm("Do you want to play this event card instead of discarding it?");
          if (c) {
            pandemic_self.playEvent(cid, function(){pandemic_self.playerDiscardCards();});
          }
        }else{
          pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${cid}`);
          pandemic_self.removeCardFromHand(pandemic_self.game.player, cid);  
          pandemic_self.playerDiscardCards();
        }
      });
    }else{
      super.endTurn();
    }
  }

  removeEvents() {
    try {
      $(".card").off();
      $(".city").off();
    } catch (err) {}
  }


  playerMakeMove() {
    if (this.browser_active == 0) {
      return;
    }
 
    let pandemic_self = this;
    let player = this.game.players_info[this.game.player - 1];
    let city = player.city;
    //console.log(player.cards);

    if (player.type === 3){ //Medic
      //Medics automatically remove cured diseases
      for (let v in this.game.cities[city].virus){
        if (this.game.cities[city].virus[v] > 0 && this.game.state.cures[v]){
          let cubes_to_cure = Math.min(3,this.game.cities[city].virus[v]);
          this.game.cities[city].virus[v] -= cubes_to_cure;
          this.game.state.active[v] -= cubes_to_cure;
          this.addMove(`cure\t${this.game.player}\t${city}\t${cubes_to_cure}\t${v}`);        
        }
      }
      this.showBoard();
    }

   $(".city").off();

   if (this.active_moves <= 0) {
      this.endTurn();
      return;
    }

    //Allow shortcut to just click on cities to move
    let xpos, ypos;
    $(".city").on("mousedown", function (e) {
      xpos = e.clientX;
      ypos = e.clientY;
    });
    //Create as menu on the game board to input word from a tile in horizontal or vertical direction
    $(".city").on("mouseup", function (e) {
      if (Math.abs(xpos - e.clientX) > 4) {
        return;
      }
      if (Math.abs(ypos - e.clientY) > 4) {
        return;
      }
      let selection = $(this).attr("id");
      console.log(selection);
      let hops = pandemic_self.returnHopsToCityFromCity(selection, city);
      if (hops <= pandemic_self.active_moves) {
        let html = `
        <div class="popup-confirm-menu">
          <div class="popup-prompt">Move to ${pandemic_self.game.cities[selection].name} (${hops} move${hops>1?"s":""})?</div>
          <div class="action" id="confirm">yes</div>
          <div class="action" id="cancel">cancel</div>
        </div>`;

        let left = $(this).offset().left + 50;
        let top = $(this).offset().top + 20;
        
        $(".popup-confirm-menu").remove();
        $("body").append(html);
        $(".popup-confirm-menu").css({
              position: "absolute",
              top: top,
              left: left,
            });

        $(".action").off();
        $(".action").on("click", function () {
          let confirmation = $(this).attr("id");
          $(".action").off();
          $(".popup-confirm-menu").remove();
          if (confirmation === "confirm"){
            pandemic_self.moveHelper(selection, hops);    
          } 
        });
      }
    });


    /* Determine which actions the player is allowed to do and update HUD controls */
    let move_opacity = 1; //Always possible because if 0 moves left, the turn has already ended
    let treat_opacity = 0.4;
    let build_opacity = 0.4;
    let discover_cure_opacity = 0.4;
    let cards_opacity = 0.4;

    let statMsg = `YOUR TURN: ${player.role} in ${this.game.cities[city].name} [${this.active_moves}]:`;
    let can_play_event_card = 0;
    let can_share_knowledge = 0;

    if (this.isCityInfected(city) == 1) {
      treat_opacity = 1; 
    }
    if (this.canPlayerBuildResearchStation(city) == 1) {
      build_opacity = 1;
    }
    if (this.canPlayerDiscoverCure() == 1) {
      discover_cure_opacity = 1;
    }

    if (this.canPlayerShareKnowledge() == 1) {
      can_share_knowledge = 1;
      cards_opacity = 1;
    }

    let can_charter_flight = (player.cards.includes(city));
    
    if (player.type === 4 && this.game.state.research_stations.includes(city) && player.cards.length > 0){
      can_charter_flight = true;
    }
    
    if (
      player.cards.includes("event1") ||
      player.cards.includes("event2") ||
      player.cards.includes("event3") ||
      player.cards.includes("event4") ||
      player.cards.includes("event5")
    ) {
      cards_opacity = 1;
      can_play_event_card = 1;
    }

    let html = `<div class="status-message">${statMsg}</div>
       <div class='status-icon-menu'>
       <div class="menu_icon" id="move" title="Move to new city"><img class="menu_icon_icon" src="/pandemic/img/icons/MOVE.png" /></div>
       <div class="menu_icon" id="treat" style="opacity:${treat_opacity}" title="Treat disease in this city (remove one cube)"><img class="menu_icon_icon" src="/pandemic/img/icons/TREAT.png" /></div>
       <div class="menu_icon" id="build" style="opacity:${build_opacity}" title="Build an operations center in this city"><img class="menu_icon_icon" src="/pandemic/img/icons/BUILD.png" /></div>
       <div class="menu_icon" id="discover_cure" style="opacity:${discover_cure_opacity}" title="Discover cure to a disease"><img class="menu_icon_icon" src="/pandemic/img/icons/CURE.png" /></div>
       <div class="menu_icon" id="cards" style="opacity:${cards_opacity}" title="Play event card or share knowledge (give another player a card)"><img class="menu_icon_icon" src="/pandemic/img/icons/CARDS.png" /></div>
       </div>`;

    $(".menu_icon").off();
    this.updateStatus(html);
    $(".menu_icon").on("click", function () {
      let action = $(this).attr("id");
      let flight1 = player.cards.length > 0 ? 1 : 0.4;
      let flight2 = can_charter_flight ? 1 : 0.4;
      let flight3 =
        pandemic_self.game.state.research_stations.length > 1 &&
        pandemic_self.game.state.research_stations.includes(city)
          ? 1
          : 0.4;
      switch (action) {
        case "move":
          html = `<div class="status-message">${statMsg}</div>
            <div class='status-icon-menu'>
            <div class="menu_icon" id="goback" title="return to previous menu"><i class="menu_icon_icon fas fa-arrow-alt-circle-left"></i><div class="menu-text">Go back</div></div>
            <div class="menu_icon" id="move" title="ground transportation to an adjacent city"><i class="menu_icon_icon fas fa-car-side"></i><div class="menu-text">Drive/Ferry</div></div>
            <div class="menu_icon" id="direct" style="opacity:${flight1}" title="Play a card from your hand to go to that city"><i class="menu_icon_icon fas fa-plane-arrival"></i><div class="menu-text">Direct flight</div></div>
            <div class="menu_icon" id="charter" style="opacity:${flight2}" title="Play the ${city} card to go anywhere in the world"><i class="menu_icon_icon fas fa-plane-departure"></i><div class="menu-text">Charter flight</div></div>
            <div class="menu_icon" id="shuttle" style="opacity:${flight3}" title="move between research stations"><i class="menu_icon_icon fas fa-plane"></i><div class="menu-text">Shuttle flight</div></div>
            </div>`;

          $(".menu_icon").off();
          pandemic_self.updateStatus(html);
          $(".menu_icon").on("click", function () {
            let action = $(this).attr("id");
            if (action == "goback") {
              pandemic_self.playerMakeMove();
            }
            if (action === "move") {
              pandemic_self.movePlayer();
            }
            if (action === "direct" && player.cards.length > 0) {
                pandemic_self.directFlight(); 
            }
            if (action === "charter" && can_charter_flight){
              pandemic_self.charterFlight(city);
            }
            if (action === "shuttle" && flight3 === 1) {
              pandemic_self.shuttleFlight();
            }
          });
          break;
        case "treat":
          if (treat_opacity != 1) {
            salert("You may not treat disease");
            return;
          }
          pandemic_self.cureDisease();
          break;
        case "discover_cure":
          if (discover_cure_opacity != 1) {
            salert("You may not discover a cure now");
            return;
          }
          pandemic_self.discoverCure();
          break;
        case "build":
          if (build_opacity != 1) {
            salert("You cannot build a research station here");
            return;
          }
          pandemic_self.buildResearchStation();

          break;

        case "cards":
          if (cards_opacity != 1) {
            salert(
              "You do not have event cards and cannot share cards with anyone now"
            );
            return;
          }
          html = "<ul>";
          if (can_play_event_card == 1) {
            html +=
              '<li class="menu_option" id="eventcard">play event card</li>';
          }
          if (can_share_knowledge == 1) {
            html +=
              '<li class="menu_option" id="shareknowledge">give player card</li>';
          }
          html += "</ul>";

          $(".menu_option").off();
          pandemic_self.updateStatusWithOptions(statMsg, html,true);
          $(".menu_option").on("click", function () {
            let action = $(this).attr("id");

            if (action === "eventcard") {
              pandemic_self.playEventCard();
              return 0;
            }
            if (action === "shareknowledge") {
              pandemic_self.shareKnowledge();
              return 0;
            }
          });
          break;

        default:
          // "pass"?
          pandemic_self.playerMakeMove();
      }
    });
  }

  findCardOwner(city){
    //Who has the card matching the city
    for (let i = 0; i < this.game.players_info.length; i++){
      let player = this.game.players_info[i];
      for (let j = 0; j < player.cards.length; j++){
        if (player.cards[j] === city){
          return i+1; //Player Number of actual owner
        }
      }
    }
    return 0;
  }

//TODO: Add Researcher -- much more complicated !!!!
  shareKnowledge() {
    let pandemic_self = this;
    let player = this.game.players_info[this.game.player-1];
    let city = player.city; //Where am I 

    //Assume I have the card
    let cardOwner = this.findCardOwner(city);
    if (cardOwner == 0){
      console.error("No one has the card!");
      return;
    }

    //Give Me the Card
    if (cardOwner != this.game.player) {
      //CardOwner needs to approve this...!!!!
      this.addMove(`takecard\t${this.game.player}\t${cardOwner}\t${city}`); //Remove from their hand
      
      player.cards.push(city); //Add to my hand (so I can play immediately)
      pandemic_self.active_moves--;
      pandemic_self.playerMakeMove();
      
    }else { //I give the card
      //Pick who to offer the card to, even if only one person

      let html = "<ul>";
      for (let i = 0; i < this.game.players_info.length; i++) {
        if (this.game.players_info[i].city == city && i != this.game.player - 1) {
          html += `<li class="nocard" id="${(i + 1)}">Player ${(i + 1)} (${this.game.players_info[i].role})</li>`;
        }
      }
      html += "</ul>";

      this.updateStatusWithOptions(`Give card to whom?`, html,true);

      $(".nocard").off();
      $(".nocard").on("click", function () {
        let id = $(this).attr("id");
        pandemic_self.addMove(`givecard\t${pandemic_self.game.player}\t${id}\t${city}`);
       
        for (let i = 0; i < player.cards.length; i++) {
          if (player.cards[i] == city) {
            player.cards.splice(i, 1);
          }
        }
        //pandemic_self.removeCardFromHand(pandemic_self.game.player,city); //Immediately remove card from my hand
        pandemic_self.active_moves--;
        pandemic_self.playerMakeMove();
      });
    }

    return;
  }

  /*
  Two players must be in the same city and one of them has to have the card
  */
  canPlayerShareKnowledge() {
    let player = this.game.players_info[this.game.player - 1];
    let city = player.city;
    let has_city_card = false;

    players_in_city = 0;
    for (let i = 0; i < this.game.players_info.length; i++) {
      if (this.game.players_info[i].city == city) {
        for (let k = 0; k < this.game.players_info[i].cards.length; k++) {
          if (this.game.players_info[i].cards[k] == city) {
             has_city_card = true;
          }
        }  
        players_in_city++;
      }
    }

    if (players_in_city >= 2 && has_city_card){
      return true;
    }
   
    return false;
  }


  canPlayerDiscoverCure() {
    let cards = this.game.players_info[this.game.player - 1].cards;
    let city = this.game.players_info[this.game.player - 1].city;

    if (!this.game.state.research_stations.includes(city)) {
      return 0;
    }

    let cardColors = {blue:0, yellow:0,red:0, black:0};
    
    let research_limit = 5;
    if (this.game.players_info[this.game.player - 1].type == 2) { //Scientist 
      research_limit = 4;
    }

    for (let i = 0; i < cards.length; i++) {
      if (this.game.deck[0].cards[cards[i]] != undefined) {
        cardColors[this.game.deck[0].cards[cards[i]].virus]++;
      }
    }
    for (let color in cardColors){
      if (cardColors[color]>=research_limit && !this.game.state.cures[color]){
        return 1;
      }
    }

    return 0;
  }

  /*
  We may come to this function from playerMakeMove or from discardCards, 
  so continueFunction tells us where to go after we are done
  */
  playEvent(event, continueFunction){
    let pandemic_self = this;
    console.log(`Playing event: ${event}`);
      //
      // AIRLIFT
      //
      if (event == "event1") {
        html = "<ul>";
        for (let i = 0; i < pandemic_self.game.players_info.length; i++) {
          html +=
            `<li id="${(i + 1)}" class="card">Player ${(i + 1)} (${pandemic_self.game.players_info[i].role})</li>`;
        }
        html += "</ul>";

        pandemic_self.updateStatusWithOptions(`Pick a pawn to move to another city:`, html, true);

        $(".card").off();
        $(".card").on("click", function () {
          let player_to_move = $(this).attr("id");
          let cities_array = [];

          html = "<ul>";
          for (let key in pandemic_self.game.cities) {
            cities_array.push(key);
          }
          cities_array.sort();

          for (let i = 0; i < cities_array.length; i++) {
            html +=
              '<li id="' +
              cities_array[i] +
              '" class="card">' +
              pandemic_self.game.cities[cities_array[i]].name +
              "</li>";
          }
          html += "</ul>";

          pandemic_self.updateStatusWithOptions("Move to which city:", html,false);

          $(".card").off();
          $(".card").on("click", function () {
            let city_destination = $(this).attr("id");

            pandemic_self.game.players_info[
              pandemic_self.game.player - 1
            ].city = city_destination;
            pandemic_self.showBoard();
            pandemic_self.addMove(`move\t${player_to_move}\t${city_destination}`);
            pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
            pandemic_self.removeCardFromHand(pandemic_self.game.player, event);
            continueFunction();
          });
        });
      }

      //
      // RESILIENT POPULATION
      //
      if (event == "event2") {
        this.defaultDeck = 0;
        this.card_height_ratio = 0.709;
        pandemic_self.updateStatusAndListCards(`Resilient Population: remove a card from the infection discard pile`, this.game.deck[0].discards);
        pandemic_self.attachCardboxEvents(function(c){
          pandemic_self.addMove("resilientpopulation\t" + c);
          pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
          pandemic_self.removeCardFromHand(pandemic_self.game.player, event);      
          
          //Restore defaults
          pandemic_self.defaultDeck = 1;
          pandemic_self.card_height_ratio = 1.41;
          continueFunction();
        });
      }

      //
      // ONE QUIET NIGHT
      //
      if (event == "event3") {
        pandemic_self.updateLog("One Quiet Night: skipping the next infection stage.");
        pandemic_self.game.state.one_quiet_night = 1;
        pandemic_self.addMove("onequietnight");
        pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
        pandemic_self.removeCardFromHand(pandemic_self.game.player, event);
        continueFunction();
      }

      //
      // FORECAST
      //
      if (event == "event4") {
        pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
        pandemic_self.removeCardFromHand(pandemic_self.game.player, event);

        let forecast = [];
        let forecast2 = [];
        for (let i = 0; i < 6; i++) {
          forecast.push(pandemic_self.app.crypto.hexToString(pandemic_self.game.deck[0].crypt[i]));
        }

        this.defaultDeck = 0;
        this.card_height_ratio = 0.709;
        pandemic_self.updateStatusAndListCards(`These are the top cards of the infection pile. Put them back on the pile one-by-one:`, forecast);
        pandemic_self.attachCardboxEvents(function(x){
          forecast2.push(x);

          if (forecast2.length == 6) {
            let y = "forecast\t6";
            for (let j = 5; j>=0; j--){
              y += "\t"+forecast2[j];  
            }
            pandemic_self.addMove(y);
            //Restore defaults
            pandemic_self.defaultDeck = 1;
            pandemic_self.card_height_ratio = 1.41;
            console.log(forecast2);
            continueFunction();
            return;
          }
          forecast.splice(forecast.indexOf(x),1);
          pandemic_self.updateStatusAndListCards(`These are the top cards of the infection pile. Put them back on the pile one-by-one:`, forecast);
          pandemic_self.cardbox.attachCardEvents();
        });
      }

      //
      // GOVERNMENT GRANT
      if (event == "event5") {
        let cities_array = [];

        html = "<ul>";
        for (let key in pandemic_self.game.cities) { //Get keys of object
          cities_array.push(key);
        }
        cities_array.sort();

        for (let i of cities_array) { //Iterate over array
          console.log(i);
          if (!pandemic_self.game.state.research_stations.includes(i)) {
            html += `<li id="${i}" class="nocard">${pandemic_self.game.cities[i].name}</li>`;
          }
        }
        html += "</ul>";
        
        pandemic_self.updateStatusWithOptions(`Pick a city for a free research station:`, html);

        let pickedStation = function () {
          let city = $(this).attr("id");
          if (pandemic_self.game.state.research_stations.includes(city)){
            salert(`${pandemic_self.game.cities[city].name} already has a research station!`);
            return;
          }
          let slot = pandemic_self.game.state.research_stations.length;

          //Maximum of 6 
          if (slot == 6) {
            //Have player pick a city
            let html = "<ul>";
            for (let i = 0; i < slot; i++){
              html += `<li class="nocard" id="${i}">${pandemic_self.game.cities[pandemic_self.game.state.research_stations[i]].name}</li>`;
            }
            html += "</ul>";

            pandemic_self.updateStatusWithOptions(`Destroy a previous research station:`, html);

            $(".nocard").off();
            $(".nocard").on("click", function () {
              slot = $(this).attr("id");
              pandemic_self.placeStation(slot, city, false);
              pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
              pandemic_self.removeCardFromHand(pandemic_self.game.player, event);
              continueFunction();
            });
          
          }else{ 
              pandemic_self.placeStation(slot, city, false);
              pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${event}`);
              pandemic_self.removeCardFromHand(pandemic_self.game.player, event);
              continueFunction();
          }
        };

        $(".nocard").off();
        $(".nocard").on("click", pickedStation);
        $(".city").off();
        $(".city").on("click", pickedStation);
      }
  }

  playEventCard() {
    let cards = this.game.players_info[this.game.player - 1].cards;
    let pandemic_self = this;

    let html = "<ul>";
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].includes("event")) {
        html += `<li id="${cards[i]}" class="card">${this.game.deck[1].cards[cards[i]].name}</li>`;
      }
    }
    html += "</ul>";

    this.updateStatusWithOptions(`Play an event card:`, html,true);

    $(".card").off();
    $(".card").on("click", function () {
      let id = $(this).attr("id");

      pandemic_self.playEvent(id, function(){pandemic_self.playerMakeMove();});
    });
  }
  discoverCure() {
    let cards = this.game.players_info[this.game.player - 1].cards;
    let pandemic_self = this;

    let cardColors = {blue:0, yellow:0,red:0, black:0};
    
    let research_limit = 5;
    if (this.game.players_info[this.game.player - 1].type == 2) { //Scientist 
      research_limit = 4;
    }

    for (let i = 0; i < cards.length; i++) {
      if (this.game.deck[0].cards[cards[i]] != undefined) {
        cardColors[this.game.deck[0].cards[cards[i]].virus]++;
      }
    }
    
    let html = "<ul>";
    for (let color in cardColors){
      if (cardColors[color]>=research_limit && !this.game.state.cures[color]){
        html += `<li id="${color}" class="nocard">${color}</li>`;  
      }
    }

    html += "</ul>";

    this.updateStatusWithOptions(`Research Cure:`, html,true);

    $(".nocard").off();
    $(".nocard").on("click", function () {
      let c = $(this).attr("id");

      let cards =  pandemic_self.game.players_info[pandemic_self.game.player - 1].cards;

      for (let i = 0, k = 0; k < research_limit && i < cards.length; i++) {
        if (pandemic_self.game.deck[0].cards[cards[i]] != undefined) {
          if (pandemic_self.game.deck[0].cards[cards[i]].virus == c) {
            pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${cards[i]}`);
            pandemic_self.removeCardFromHand(pandemic_self.game.player,cards[i]);
            i--; //reset index after removal
            k++;
          }
        }
      }
      pandemic_self.active_moves--;
      pandemic_self.game.state.cures[c] = true;
      
      if (
        pandemic_self.game.state.cures.yellow &&
        pandemic_self.game.state.cures.red &&
        pandemic_self.game.state.cures.blue &&
        pandemic_self.game.state.cures.black
      ) { //Will other players catch up on the moves that lead to the end state????
        pandemic_self.endGame("You win: all diseases cured");
        return;
      }

      pandemic_self.addMove(`curevirus\t${pandemic_self.game.player}\t${c}`);

      pandemic_self.showBoard();

      pandemic_self.playerMakeMove();

    });
  }

  isCityInfected(city) {
    for (let v in this.game.cities[city].virus){
      if (this.game.cities[city].virus[v] > 0){
        return 1;
      }
    }
    return 0;
  }

  canPlayerBuildResearchStation(city) {
    //Have to be in the city
    if (this.game.players_info[this.game.player - 1].city !== city) {
      return 0;
    }
    //Only one research station per city
    if (this.game.state.research_stations.includes(city)) {
      return 0;
    }

    // operations experts can build without card
    if (this.game.players_info[this.game.player - 1].type == 4) {
      return 1;
    }

    //Need city card
    for (
      let i = 0;
      i < this.game.players_info[this.game.player - 1].cards.length;
      i++
    ) {
      if (this.game.players_info[this.game.player - 1].cards[i] == city) {
        return 1;
      }
    }

    return 0;
  }

  returnHopsToCityFromCity(fromcity, tocity) {
    let hops = 0;
    let current_cities = [];
    let new_cities = [];
    current_cities.push(fromcity);

    //
    // graph will eventually close
    //
    while (1) {
      new_cities = [];
      hops++;

      for (let i = 0; i < current_cities.length; i++) {
        let neighbours = this.game.cities[current_cities[i]].neighbours;
        for (let k = 0; k < neighbours.length; k++) {
          if (neighbours[k] == tocity) {
            return hops;
          } else {
            if (!new_cities.includes(neighbours[k])) {
              new_cities.push(neighbours[k]);
            }
          }
        }
      }

      current_cities = new_cities;
    }
  }



  movePlayer(player = 0) {
    // 0 = me

    let pandemic_self = this;
    let city = this.game.players_info[this.game.player - 1].city;

    let html = "<ul>";
    for (let i = 0; i < this.game.cities[city].neighbours.length; i++) {
      let c = this.game.cities[city].neighbours[i];
      html +=
        `<li class="card" id="${c}">${this.game.cities[c].name}</li>`;
    }
    html += "</ul>";

    this.updateStatusWithOptions(`Move where (or click board):`, html,true);


    $(".city").on("click", function () {
      let selection = $(this).attr("id");
      let startCity = pandemic_self.game.players_info[pandemic_self.game.player - 1].city;
      let hops = pandemic_self.returnHopsToCityFromCity(selection, startCity);

      if (hops > pandemic_self.active_moves) {
        alert("Invalid Move -- too many hops");
      } else {
        pandemic_self.moveHelper(selection, hops);
      }
    });

    $(".card").off();
    $(".card").on("click", function () {
      let c = $(this).attr("id");
      pandemic_self.moveHelper(c, 1);
    });
  }

  moveHelper(destination, numMoves){
    this.active_moves -= numMoves;
    this.addMove(`move\t${this.game.player}\t${destination}`);
    this.game.players_info[this.game.player-1].city = destination;
    this.showBoard();
    this.playerMakeMove();
  }

 //>>>>>>>>>>>>
  directFlight() {
    let pandemic_self = this;
    let city = this.game.players_info[this.game.player - 1].city;
    let cards = this.game.players_info[this.game.player - 1].cards.filter(c => !c.includes("event") && c !== city);

    this.updateStatusAndListCards("Take a direct flight to which city:", cards, true);
    this.attachCardboxEvents(function (c) {
      pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${c}`);
      pandemic_self.removeCardFromHand(pandemic_self.game.player, c);
      pandemic_self.moveHelper(c, 1);
    });
  }

  charterFlight(city){
    let pandemic_self = this;
    if (this.game.players_info[this.game.player-1].type === 4 && this.game.state.research_stations.includes(city)){
      let cards = this.game.players_info[this.game.player - 1].cards.filter(c => !c.includes("event"));
      this.updateStatusAndListCards(`Discard a city card to charter a flight anywhere on the board`, cards, true);
      this.attachCardboxEvents(function (c){
        pandemic_self.updateStatusWithOptions(`Discard [${pandemic_self.game.cities[c].name}] to go anywhere on the board`,"",true);
        $(".city").off();
        $(".city").on("click", function(){
          let destination = $(this).attr("id");
          pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${city}`);
          pandemic_self.removeCardFromHand(pandemic_self.game.player, city);
          pandemic_self.moveHelper(destination,1);
        });
      });
    }else{
      this.updateStatusWithOptions(`Discard [${this.game.cities[city].name}] to go anywhere on the board`,"",true);
    $(".city").off();
    $(".city").on("click", function(){
      let c = $(this).attr("id");
      pandemic_self.addMove(`discard\t${pandemic_self.game.player}\t${city}`);
      pandemic_self.removeCardFromHand(pandemic_self.game.player, city);
      pandemic_self.moveHelper(c,1);
    });  
    }
    
  }

  shuttleFlight() {
    let pandemic_self = this;
    let city = this.game.players_info[this.game.player - 1].city;

    let html = "<ul>";
    for (let rs of this.game.state.research_stations) {
      if (rs !== city){
        html += `<li class="card" id="${rs}">${this.game.cities[rs].name}</li>`;  
      }
    }
    html += "</ul>";

    this.updateStatusWithOptions(`Take a shuttle flight:`, html, true);

    $(".card").off();
    $(".card").on("click", function () {
      let c = $(this).attr("id");
      pandemic_self.moveHelper(c,1);
    });
  }


  cureDisease() {
    let pandemic_self = this;
    let city = this.game.players_info[this.game.player - 1].city;
    let cubes_to_cure = 1;
    let number_of_diseases = 0;
    let disease = "";
    let html = "<ul>";

    for (let v in this.game.cities[city].virus){
      if (this.game.cities[city].virus[v] > 0){
        number_of_diseases++;
        disease = v;
        html += `<li class="nocard" id="${v}">${v}</li>`;
      }
    }
    
    //
    // if there is just one type, cure it
    if (number_of_diseases === 1) {
      
      //Medics can clear it all in one move or if we have the cure
      if (this.game.players_info[this.game.player - 1].type == 3 || this.game.state.cures[disease]) {
        cubes_to_cure = Math.min(3,this.game.cities[city].virus[disease]);
      } 

      let cure_capacity = Math.min(this.active_moves,this.game.cities[city].virus[disease]);
      if (cure_capacity > cubes_to_cure){
        html = `<ul>`;
        for (let j = 1; j <= cure_capacity; j++){
          html += `<li class="nocard" id="${j}">${j} cube${(j>1?"s":"")}</li>`;
        }
        html +="</ul>";
        this.updateStatusWithOptions(`Remove how many cubes? [${this.active_moves}]`,html,true);
          $(".nocard").off();
          $(".nocard").on("click", function () {
            let c = parseInt($(this).attr("id"));
            pandemic_self.game.cities[city].virus[disease] -= c;
            pandemic_self.game.state.active[disease] -= c;
            pandemic_self.active_moves -= c;
            pandemic_self.addMove(`cure\t${pandemic_self.game.player}\t${city}\t${c}\t${disease}`);  
            pandemic_self.showBoard();
            pandemic_self.playerMakeMove();            
          });
      }else{
        this.game.cities[city].virus[disease] -= cubes_to_cure;
        this.game.state.active[disease] -= cubes_to_cure;
        this.active_moves--;
        this.addMove(`cure\t${this.game.player}\t${city}\t${cubes_to_cure}\t${disease}`);  
        this.showBoard();
        this.playerMakeMove();
      }
      
    }else{ //Player has to pick a color of disease to cure
      html += "</ul>";
      this.updateStatusWithOptions(`Cure disease:`, html,true);

      $(".nocard").off();
      $(".nocard").on("click", function () {
        let c = $(this).attr("id");
        pandemic_self.active_moves--;

        if (pandemic_self.game.players_info[pandemic_self.game.player - 1].type == 3 || pandemic_self.game.state.cures[c]) {
          cubes_to_cure = Math.min(3,pandemic_self.game.cities[city].virus[c]);
        } //Medics can clear it all in one move or if we have the cure

       pandemic_self.game.cities[city].virus[c] -= cubes_to_cure;
       pandemic_self.game.state.active[c] -= cubes_to_cure;

       pandemic_self.addMove(`cure\t${pandemic_self.game.player}\t${city}\t${cubes_to_cure}\t${c}`);

       pandemic_self.showBoard();
       pandemic_self.playerMakeMove();
      });
    }
  }

 

  /* Done */
  buildResearchStation() {
    let pandemic_self = this;
    let player = this.game.players_info[this.game.player - 1];
    let city = player.city; //research station will be built where the player is
    let slot = this.game.state.research_stations.length;


    //Maximum of 6 
    if (slot == 6) {
      //Have player pick a city
      let html = "<ul>";
      for (let i = 0; i < slot; i++){
        html += `<li class="nocard" id="${i}">${this.game.cities[this.game.state.research_stations[i]].name}</li>`;
      }
      html += "</ul>";

      this.updateStatusWithOptions(`Destroy a previous research station:`, html, true);

      $(".nocard").off();
      $(".nocard").on("click", function () {
        slot = $(this).attr("id");
        this.active_moves--;
        pandemic_self.placeStation(slot, city, (player.type !== 4));
      });
    
    }else{ //To avoid asynch, just use logic and a bit of repetition
      this.active_moves--;
      this.placeStation(slot, city, (player.type !== 4));
    } 
  }


  placeStation(slot, city, discard = true){
      let player = this.game.players_info[this.game.player - 1];

      if (discard){
          this.addMove(`discard\t${this.game.player}\t${city}`);
          this.removeCardFromHand(this.game.player,city);
      }
      this.game.state.research_stations[slot] = city;
      this.addMove(`buildresearchstation\t${this.game.player}\t${city}\t${slot}`);
      this.showBoard();
      this.playerMakeMove();
  }
    
  isEradicated(virus){
    return this.game.state.cures[virus] && this.game.state.active[virus] === 0;
  }


  //
  // Core Game Logic
  //
  handleGameLoop() {
    let pandemic_self = this;

    ///////////
    // QUEUE //
    ///////////
    if (this.game.queue.length > 0) {
      console.log("QUEUE: " + this.game.queue);
      console.log(this.quarantine);
      pandemic_self.saveGame(pandemic_self.game.id);

      let qe = this.game.queue.length - 1;
      let mv = this.game.queue[qe].split("\t");
      let shd_continue = 1;


      if (mv[0] === "start") {
        this.game.queue.splice(qe, 1);
      }
      if (mv[0] === "forecast") {
        let cards_to_update = parseInt(mv[1]);
        for (let i = 0; i < cards_to_update; i++) {
          let newcard = mv[i + 2];
          this.updateLog(newcard + " on top of infection pile...");
          this.game.deck[0].crypt[i] = this.app.crypto.stringToHex(newcard);
        }
        this.game.queue.splice(qe, 1);
      }
      if (mv[0] === "resilientpopulation") {
        for (let i = 0; i < this.game.deck[0].discards.length; i++) {
          if (this.game.deck[0].discards[i] == mv[1]) {
            this.game.deck[0].discards.splice(i, 1);
            break;
          }
        }
        this.game.queue.splice(qe, 1);
      }

      if (mv[0] === "discard") {
        let player = parseInt(mv[1]);
        let card = mv[2];

        this.game.queue.splice(qe, 1);
        
        if (player != this.game.player){
          this.removeCardFromHand(player,card);
        }
      
      }




      if (mv[0] === "round") {

        this.game.queue.push("turn\t1");
        this.game.state.welcome = 0;
      }

      if (mv[0] === "turn") {
        if (this.browser_active == 1) {
          if (this.game.state.welcome == 0) {
            this.overlay.show(this.app, this, this.returnWelcomeOverlay());
            document.querySelector(".close_welcome_overlay").onclick = (e) => {
              this.overlay.hide();
            };
            this.game.state.welcome = 1;
          }
          if (parseInt(mv[1]) == this.game.player) {
            this.playerTurn();
          } else {
            this.removeEvents();
            this.updateStatusAndListCards(
              `Waiting for ${this.app.keys.returnUsername(this.game.players[parseInt(mv[1]) - 1])} 
              (${this.game.players_info[parseInt(mv[1]) - 1].role})`,
              this.game.players_info[this.game.player - 1].cards
            );
            this.attachCardboxEvents();
          }
        }
        return 0;
      }
      if (mv[0] === "draw_player_card") {
        
        this.game.queue.splice(qe, 1); //Remove this draw_player_card
        let player = parseInt(mv[1]) - 1;
        let cards = parseInt(mv[2]);
        if (cards > 0){
          this.updateLog(`${this.game.deck[1].crypt.length} cards left in deck. Player ${mv[1]} drawing ${mv[2]}.`);  
        }
        
        for (let i = cards - 1; i >= 0; i--) {
          if (this.game.deck[1].crypt.length == 0) {
            this.endGame("No more cards. You have failed to contain the pandemic in time.");
            return;
          }

          let card = this.drawPlayerCard(player);

          if (card.includes("epidemic")){            
            //this.addMove("RESOLVE");
            this.game.queue.push("draw_player_card\t" + mv[1] + "\t" + i);
            this.game.queue.push("epidemic");
            return 1;
          } else {
            this.game.players_info[player].cards.push(card);
          }
        }
      
      /*   console.log(JSON.parse(JSON.stringify(this.moves)));
         this.moves.reverse();
         for (let m in moves){
          this.game.queue.push(m);
         } 
      */
        //Here is where we need to check if players have overly large hands
        //...
            // discard extra cards
        if (this.game.players_info[player].cards.length > this.maxHandSize) {
          if (player + 1 === this.game.player){
            this.playerDiscardCards();  
          }else{
            this.updateStatusAndListCards(`Player ${player+1} (${this.game.players_info[player].role}) has to discard some cards`,this.game.players_info[this.game.player - 1].cards);
          }
          return 0;
        }else{
          return 1;
        } 
      }
      if (mv[0] === "epidemic") {
        this.game.queue.splice(qe, 1);
        this.game.state.infection_rate++;

        this.outbreaks = [];
        let city = this.drawInfectionCardFromBottomOfDeck();
        let virus = this.game.deck[0].cards[city].virus;
        this.updateLog(`Epidemic in ${city}`);
        if (this.isEradicated(virus)){
          this.updateLog(`No new infections because ${virus} already eradicated!`);
        }else{
          //If already has virus, add just enough to trigger an outbreak, otherwise 3 cubes
          for (let i = Math.max(0,this.game.cities[city].virus[virus]-1); i < 3; i ++){
            this.addDiseaseCube(city, virus);  
          }          
        }

        //
        // show overlay
        //
        this.overlay.show(this.app, this, this.returnEpidemicOverlay(city));
        document.querySelector(".close_epidemic_overlay").onclick = (e) => {
          pandemic_self.overlay.hide();
        };
        this.overlay.blockClose();

        //
        // shuffle cards into TOP of infection deck
        //
        let new_deck = [];

        for (let i = 0; i < this.game.deck[0].discards.length; i++) {
          let roll = this.rollDice(this.game.deck[0].discards.length);
          new_deck.push(this.app.crypto.stringToHex(this.game.deck[0].discards[roll - 1]));
          this.game.deck[0].discards.splice(roll - 1, 1);
        }

        for (let i = 0; i < this.game.deck[0].crypt.length; i++) {
          new_deck.push(this.game.deck[0].crypt[i]);
        }

        this.game.deck[0].crypt = new_deck;
        this.game.deck[0].discards = [];

        this.showBoard();
      }
      if (mv[0] === "infect") {
        let infection_cards = 2;
        if (this.game.state.infection_rate > 2) {
          infection_cards = 3;
        }
        if (this.game.state.infection_rate > 4) {
          infection_cards = 4;
        }

   
        if (this.game.state.one_quiet_night == 0) {
          this.updateLog(`INFECTION STAGE: ${infection_cards} cards to draw`);

          for (let i = 0; i < infection_cards; i++) {
            this.outbreaks = [];

            let city = this.drawInfectionCard();
            let virus = this.game.deck[0].cards[city].virus;

            if (!this.game.state.cures[virus] || this.game.state.active[virus] > 0) { 
              
              if (this.quarantine && (this.quarantine === city || this.game.cities[city].neighbours.includes(this.quarantine))){
                this.updateLog(`Quarantine Specialist blocks new infection in ${this.game.cities[city].name}`);
              }else{
                this.updateLog(this.game.cities[city].name + " gains 1 disease cube");
                this.prependMove(`ACKNOWLEDGE\tInfection: 1 ${virus} added to ${this.game.cities[city].name}`);
                this.addDiseaseCube(city, virus);
              }
            } else {
              this.updateLog(`Eradicated disease prevents infection in ${this.game.cities[city].name}`);
            }
          }
         console.log(JSON.parse(JSON.stringify(this.moves)));
         for (let m of this.moves){
          this.game.queue.push(m);
         } 
         this.moves = [];
        }else{
          this.updateLog(`Quiet Night -- Skipping Infection Stage`);
          this.game.state.one_quiet_night = 0;
        }

        this.showBoard();

        this.game.queue.splice(qe, 1);
      }

      //
      // place initial cards
      if (mv[0] === "place_initial_infection") {
        //This is a little hack until change game template
        this.game.deck[0].discards = [];
        this.game.deck[1].discards = [];

        for (let i = 3; i > 0; i--) {
          for (let k = 0; k < 3; k++) {
            let newcard = this.drawInfectionCard();
            let virus = this.game.deck[0].cards[newcard].virus || this.game.deck[0].discards[newcard].virus;
            this.game.cities[newcard].virus[virus] = i;
            this.game.state.active[virus] += i;
            console.log(this.game.cities[newcard].virus);
            this.updateLog(`${this.game.cities[newcard].name} infected with ${i} ${virus}`);
          }
        }
        this.game.queue.splice(qe, 1);
      }

      //Insert Epidemics into player deck
      if (mv[0] === "initialize_player_deck") {
        let epidemics = (this.game.options.difficulty) ? parseInt(this.game.options.difficulty) : 4;  
        let section_length = Math.floor(this.game.deck[1].crypt.length / epidemics);

        // shuffle them into the undrawn pile
        for (let i = 0, starting_point = 0; i < epidemics; i++) {
          let cardname = "epidemic" + (i + 1);
          this.game.deck[1].cards[cardname] = { img: "Epidemic.jpg" };
            
          let insertion_point = this.rollDice(section_length);
          this.game.deck[1].crypt.splice(starting_point + insertion_point, 0, this.app.crypto.stringToHex(cardname));
          starting_point += 1;
          starting_point += section_length;
        }

        console.log("\n\n\nCARDS AS INITED: ");
        for (let i = 0; i < this.game.deck[1].crypt.length; i++) {
          console.log(this.app.crypto.hexToString(this.game.deck[1].crypt[i]));
        }

        this.game.queue.splice(qe, 1);
      }
      if (mv[0] === "curevirus") {
        let player = parseInt(mv[1]);
        let virus = mv[2];
        if (this.game.player != player) {
          this.game.state.cures[virus] = true;
        }
        this.game.queue.splice(qe, 1);
        this.updateLog(`Player ${player} (${this.game.players_info[player - 1].role}) found the cure for ${virus} disease`);
        if (this.game.state.active[virus] === 0){
          this.updateLog(`${virus} is eradicated!!!`);
        }
      }

      if (mv[0] === "onequietnight") {
        this.game.state.one_quiet_night = 1; //Set a flag to ignore the infection phase, messaging there
        this.game.queue.splice(qe, 1);
      }
      if (mv[0] === "buildresearchstation") {
        let player = parseInt(mv[1]);
        let city = mv[2];
        let slot = parseInt(mv[3]);

        if (this.game.player != player) {
          this.game.state.research_stations[slot] = city;
        }
        this.game.queue.splice(qe, 1);
        this.updateLog(`Player ${player} (${this.game.players_info[player - 1].role}) built a research station in ${this.game.cities[city].name}.`);
      }
      
      if (mv[0] === "givecard") {
        let player = parseInt(mv[1])  
        let recipient = parseInt(mv[2]);
        let card = mv[3];
        this.game.queue.splice(qe, 1);

        this.game.players_info[recipient-1].cards.push(card);
        console.log(`Player ${recipient} gains a card`);
        
        if (this.game.player !== player) {
          console.log(`Player ${player} loses a card`);
          let cards = this.game.players_info[player-1].cards;
          for (let i = 0; i < cards.length; i++) {
          if (cards[i] == card) {
            cards.splice(i, 1);
          }  
        }
        }
        this.updateLog(`Player ${player} (${this.game.players_info[player - 1].role}) shared the ${this.game.cities[card].name} card with Player ${recipient} (${this.game.players_info[recipient - 1].role})`);
      }
  
      if (mv[0] === "takecard") {
        let player = parseInt(mv[1])
        let sender = parseInt(mv[2]); 
        let card = mv[3];
        this.game.queue.splice(qe, 1);

        if (this.game.player !== player) {
          this.game.players_info[player-1].cards.push(card);
          console.log(`Player ${player} gains a card`);
        }
        
        console.log(`Player ${sender} loses a card`);
         let cards = this.game.players_info[sender-1].cards;
         for (let i = 0; i < cards.length; i++) {
          if (cards[i] == card) {
            cards.splice(i, 1);
          }
        
        }
        this.updateLog(`Player ${sender} (${this.game.players_info[sender - 1].role}) shared the ${this.game.cities[card].name} card with Player ${player} (${this.game.players_info[player - 1].role})`);
      }
      if (mv[0] === "move") {
        let player = parseInt(mv[1]);
        this.game.queue.splice(qe, 1);

        this.updateLog(`Player ${player} (${this.game.players_info[player - 1].role}) moves to ${this.game.cities[mv[2]].name}`);

        //Keep track of where the quarantine specialist is
        if (this.game.players_info[player - 1].type == 5){
          this.quarantine = mv[2];
        }

        if (this.game.player != player){
          pandemic_self.game.players_info[player - 1].city = mv[2];
          pandemic_self.showBoard();  
        }        
      }
      if (mv[0] === "cure") {
        let player = parseInt(mv[1]);
        let city = mv[2];
        let numCubes = parseInt(mv[3]);
        let virus = mv[4];
        this.game.queue.splice(qe, 1);

        this.updateLog(`Player ${player} (${this.game.players_info[player - 1].role}) removes ${numCubes} ${virus} cube${(numCubes>1?'s':"")} from ${this.game.cities[city].name}`);

        if (this.game.player !== player) {
          this.game.cities[city].virus[virus] -= numCubes;
          this.game.state.active[virus] -= numCubes;
          pandemic_self.showBoard();
        }        

        if (!this.game.state.active[virus] && this.game.state.cures[virus]){
          this.updateLog(`${virus} is eradicated!!!`);
        }
      }
      if (shd_continue == 0) {
        console.log("NOT CONTINUING");
        return 0;
      }

      return 1;
    }
  }


  endTurn() {

    this.addMove("draw_player_card\t" + this.game.player + "\t2");
    this.addMove("infect");
    this.addMove("turn\t" + this.returnNextPlayer(this.game.player));

    //Flip the order so moves are played in the correct order
    this.moves.reverse();

    console.log(JSON.parse(JSON.stringify(this.moves)));

    let extra = {};
    extra.target = this.returnNextPlayer(this.game.player);
    this.game.turn = this.moves;
    this.sendMessage("game", extra);
    this.moves = [];
    this.saveGame(this.game.id);
  }

  endGame(notice) {
    this.game.over = 1;
    alert("GAME OVER: " + notice);
    this.saveGame(this.game.id);
  }


  triggerOutbreak(city, virus) {
    this.game.state.outbreaks++;
    this.updateLog("Outbreak in " + this.game.cities[city].name);

    for (let i = 0; i < this.game.cities[city].neighbours.length; i++) {
      if (!this.outbreaks.includes(this.game.cities[city].neighbours[i])) {
        this.prependMove(`ACKNOWLEDGE\tOutbreak! Virus expands beyond ${this.game.cities[city].name}`);
        this.addDiseaseCube(this.game.cities[city].neighbours[i], virus);
      }
    }
  }

  addDiseaseCube(city, virus) {
    if (this.quarantine && (this.quarantine === city || this.game.cities[city].neighbours.includes(this.quarantine))){
      this.updateLog(`Quarantine Specialist blocks new infection in ${this.game.cities[city].name}`);
    }else{
      this.game.cities[city].virus[virus]++;
      this.game.state.active[virus]++;
      if (this.game.state.active[virus] > 24) {
        this.endGame(`${virus.toUpperCase()} Disease Outbreak Beyond Control`);
        return;
      }
      if (this.game.cities[city].virus[virus] > 3) {
        this.game.cities[city].virus[virus] = 3;
        this.outbreaks.push(city);
        this.triggerOutbreak(city, virus);
      }  
    }
        
  }

  drawInfectionCard() {
    let newcard = this.game.deck[0].crypt[0];
    newcard = this.app.crypto.hexToString(newcard);

    //this.game.state.infection_topcard = newcard;
    //this.game.state.infection_drawn.push(newcard);
    this.game.deck[0].discards.push(newcard); // = this.game.deck[0].cards[newcard];
    this.game.deck[0].crypt.splice(0, 1);

    this.showBoard();

    return newcard;
  }

  drawInfectionCardFromBottomOfDeck() {
    let newcard = this.game.deck[0].crypt[this.game.deck[0].crypt.length - 1];
    newcard = this.app.crypto.hexToString(newcard);

    //this.game.state.infection_topcard = newcard;
    //this.game.state.infection_drawn.push(newcard);
    this.game.deck[0].discards.push(newcard);// = this.game.deck[0].cards[newcard];
    this.game.deck[0].crypt.splice(this.game.deck[0].crypt.length - 1, 1);

    this.showBoard();

    return newcard;
  }

  drawPlayerCard(player = 1) {
    let newcard = this.game.deck[1].crypt[0];
    newcard = this.app.crypto.hexToString(newcard);
    this.game.deck[1].crypt.splice(0, 1);

    this.showBoard();
    console.log(this.game.deck[1]);
    return newcard;
  }

  returnState() {
    var state = {};

    state.outbreaks = 0;
    state.infection_rate = 0;

    // events
    state.one_quiet_night = 0;

    // cards
    //state.infection_topcard = "";
    //state.player_topcard = "";
    //state.infection_drawn = [];
    state.research_stations = ["atlanta"];

    // cures
    state.cures = {"blue":false, "yellow":false, "red":false,"black":false};

    // onboard
    state.active = {"blue":0, "yellow":0, "red":0,"black":0};


    return state;
  }

  //To Do: Define more roles
  returnPlayers(num = 1) {
    //Initialize Players
    var players = [];

    for (let i = 0; i < num; i++) {
      players[i] = {};
      players[i].city = "atlanta";
      players[i].moves = 4;
      players[i].cards = [];
      players[i].type = 1;
    }
    
    //Check options
    if (this.game.options.player1 != undefined) {
      players[0].role = this.game.options.player1;
    }
    if (this.game.options.player2 != undefined) {
      players[1].role = this.game.options.player2;
    }   
    if (this.game.options.player3 != undefined) {
      players[2].role = this.game.options.player3;
    }
    if (this.game.options.player4 != undefined) {
      players[3].role = this.game.options.player4;
    }

    //Remove specified roles
    let roles = ["generalist", "scientist", "medic", "operationsexpert","quarantinespecialist"];
    for (let i = 0; i < num; i++) {
      if (players[i].role !== "random"){
        roles.splice(roles.indexOf(players[i].role),1);
        console.log(`Removing role (${players[i].role}): `+JSON.parse(JSON.stringify(roles)));
      }
    }

    //Randomly assign other roles and fill in the details
    for (let i = 0; i < num; i++) {
      //Remove role as we randomly selct
      let role = players[i].role;
      if (role === "random"){
        role = roles.splice(this.rollDice(roles.length) - 1,1)[0];  
      }
    
      if (role === "generalist") {
        players[i].role = "Generalist";
        players[i].pawn = "Pawn%20Generalist.png";
        players[i].card = "Role%20-%20Generalist.jpg";
        players[i].desc =
          "The Generalist may take an extra move every turn, performing 5 actions instead of 4";
        players[i].moves = 5;
        players[i].type = 1;
      }
      if (role === "scientist") {
        players[i].role = "Scientist";
        players[i].pawn = "Pawn%20Scientist.png";
        players[i].card = "Role%20-%20Scientist.jpg";
        players[i].desc =
          "The Scientist may research a vaccine with only 4 cards instead of 5";
        players[i].type = 2;
      }
      if (role === "medic") {
        players[i].role = "Medic";
        players[i].pawn = "Pawn%20Medic.png";
        players[i].card = "Role%20-%20Medic.jpg";
        players[i].desc =
          "The Medic may remove all disease cubes in a city when they treat disease. Once a disease has been cured, the medic removes cubes of that color merely by being in the city.";
        players[i].type = 3;
      }
      if (role === "operationsexpert") {
        players[i].role = "Operations Expert";
        players[i].pawn = "Pawn%20Operations%20Expert.png";
        players[i].card = "Role%20-%20Operations%20Expert.jpg";
        players[i].desc =
          "The Operations Expert may build a research center in their current city as an action, or may discard a card to move from a research center to any other city.";
        players[i].type = 4;
      }
      if (role === "quarantinespecialist"){
        players[i].role = "Quarantine Specialist";
        players[i].pawn = "Pawn%20Quarantine%20Specialist.png";
        players[i].card = "Role%20-%20Quarantine%20Specialist.jpg";
        players[i].desc =
          "The Quarantine Specialist prevents both the placement of disease cubes and outbreaks in her present city and all neighboring cities. Initial placement of disease cubes is not affected by the Quarantine Specialist.";
        players[i].type = 5; 
      }
    }
    return players;
  }

  returnCities() {
    var cities = {};

    cities["sanfrancisco"] = {
      top: 560,
      left: 95,
      neighbours: ["tokyo", "manila", "losangeles", "chicago"],
      name: "San Francisco",
    };
    cities["chicago"] = {
      top: 490,
      left: 340,
      neighbours: [
        "sanfrancisco",
        "losangeles",
        "mexicocity",
        "atlanta",
        "montreal",
      ],
      name: "Chicago",
    };
    cities["montreal"] = {
      top: 480,
      left: 530,
      neighbours: ["chicago", "newyork", "washington"],
      name: "Montreal",
    };
    cities["newyork"] = {
      top: 505,
      left: 675,
      neighbours: ["montreal", "washington", "london", "madrid"],
      name: "New York",
    };
    cities["washington"] = {
      top: 625,
      left: 615,
      neighbours: ["montreal", "newyork", "miami", "atlanta"],
      name: "Washington",
    };
    cities["atlanta"] = {
      top: 630,
      left: 410,
      neighbours: ["chicago", "miami", "washington"],
      name: "Atlanta",
    };
    cities["losangeles"] = {
      top: 750,
      left: 135,
      neighbours: ["sydney", "sanfrancisco", "mexicocity", "chicago"],
      name: "Los Angeles",
    };
    cities["mexicocity"] = {
      top: 815,
      left: 315,
      neighbours: ["chicago", "losangeles", "miami", "bogota", "lima"],
      name: "Mexico City",
    };
    cities["miami"] = {
      top: 790,
      left: 530,
      neighbours: ["washington", "atlanta", "mexicocity", "bogota"],
      name: "Miami",
    };
    cities["bogota"] = {
      top: 980,
      left: 515,
      neighbours: ["miami", "mexicocity", "lima", "saopaulo", "buenosaires"],
      name: "Bogota",
    };
    cities["lima"] = {
      top: 1180,
      left: 445,
      neighbours: ["santiago", "bogota", "mexicocity"],
      name: "Lima",
    };
    cities["santiago"] = {
      top: 1390,
      left: 470,
      neighbours: ["lima"],
      name: "Santiago",
    };
    cities["buenosaires"] = {
      top: 1355,
      left: 670,
      neighbours: ["saopaulo", "bogota"],
      name: "Buenos Aires",
    };
    cities["saopaulo"] = {
      top: 1210,
      left: 780,
      neighbours: ["bogota", "buenosaires", "madrid", "lagos"],
      name: "Sao Paulo",
    };
    cities["lagos"] = {
      top: 950,
      left: 1150,
      neighbours: ["saopaulo", "khartoum", "kinshasa"],
      name: "Lagos",
    };
    cities["khartoum"] = {
      top: 910,
      left: 1395,
      neighbours: ["cairo", "lagos", "kinshasa", "johannesburg"],
      name: "Khartoum",
    };
    cities["kinshasa"] = {
      top: 1080,
      left: 1275,
      neighbours: ["lagos", "khartoum", "johannesburg"],
      name: "Kinshasa",
    };
    cities["johannesburg"] = {
      top: 1270,
      left: 1385,
      neighbours: ["kinshasa", "khartoum"],
      name: "Johannesburg",
    };
    cities["london"] = {
      top: 390,
      left: 1025,
      neighbours: ["newyork", "madrid", "essen", "paris"],
      name: "London",
    };
    cities["madrid"] = {
      top: 580,
      left: 1005,
      neighbours: ["newyork", "paris", "london", "algiers", "saopaulo"],
      name: "Madrid",
    };
    cities["essen"] = {
      top: 360,
      left: 1220,
      neighbours: ["stpetersburg", "london", "milan"],
      name: "Essen",
    };
    cities["paris"] = {
      top: 485,
      left: 1170,
      neighbours: ["london", "essen", "madrid", "milan", "algiers"],
      name: "Paris",
    };
    cities["stpetersburg"] = {
      top: 320,
      left: 1430,
      neighbours: ["essen", "moscow", "istanbul"],
      name: "St. Petersburg",
    };
    cities["milan"] = {
      top: 450,
      left: 1300,
      neighbours: ["essen", "istanbul", "paris"],
      name: "Milan",
    };
    cities["algiers"] = {
      top: 685,
      left: 1220,
      neighbours: ["madrid", "paris", "cairo", "istanbul"],
      name: "Algiers",
    };
    cities["cairo"] = {
      top: 720,
      left: 1360,
      neighbours: ["khartoum", "algiers", "istanbul", "baghdad", "riyadh"],
      name: "Cairo",
    };
    cities["istanbul"] = {
      top: 560,
      left: 1385,
      neighbours: [
        "stpetersburg",
        "milan",
        "algiers",
        "cairo",
        "baghdad",
        "moscow",
      ],
      name: "Istanbul",
    };
    cities["moscow"] = {
      top: 450,
      left: 1535,
      neighbours: ["stpetersburg", "tehran", "istanbul"],
      name: "Moscow",
    };
    cities["baghdad"] = {
      top: 660,
      left: 1525,
      neighbours: ["cairo", "riyadh", "karachi", "tehran", "istanbul"],
      name: "Baghdad",
    };
    cities["riyadh"] = {
      top: 830,
      left: 1545,
      neighbours: ["cairo", "istanbul", "karachi"],
      name: "Riyadh",
    };
    cities["tehran"] = {
      top: 540,
      left: 1665,
      neighbours: ["moscow", "karachi", "baghdad", "delhi"],
      name: "Tehran",
    };
    cities["karachi"] = {
      top: 720,
      left: 1705,
      neighbours: ["baghdad", "tehran", "delhi", "riyadh", "mumbai"],
      name: "Karachi",
    };
    cities["mumbai"] = {
      top: 865,
      left: 1720,
      neighbours: ["chennai", "karachi", "delhi"],
      name: "Mumbai",
    };
    cities["delhi"] = {
      top: 670,
      left: 1845,
      neighbours: ["tehran", "karachi", "mumbai", "chennai", "kolkata"],
      name: "Delhi",
    };
    cities["chennai"] = {
      top: 965,
      left: 1870,
      neighbours: ["mumbai", "delhi", "kolkata", "bangkok", "jakarta"],
      name: "Chennai",
    };
    cities["kolkata"] = {
      top: 715,
      left: 1975,
      neighbours: ["delhi", "chennai", "bangkok", "hongkong"],
      name: "Kolkata",
    };
    cities["bangkok"] = {
      top: 880,
      left: 2005,
      neighbours: [
        "kolkata",
        "hongkong",
        "chennai",
        "jakarta",
        "hochiminhcity",
      ],
      name: "Bangkok",
    };
    cities["jakarta"] = {
      top: 1130,
      left: 2005,
      neighbours: ["chennai", "bangkok", "hochiminhcity", "sydney"],
      name: "Jakarta",
    };
    cities["sydney"] = {
      top: 1390,
      left: 2420,
      neighbours: ["jakarta", "manila", "losangeles"],
      name: "Sydney",
    };
    cities["manila"] = {
      top: 1000,
      left: 2305,
      neighbours: [
        "sydney",
        "hongkong",
        "hochiminhcity",
        "sanfrancisco",
        "taipei",
      ],
      name: "Manila",
    };
    cities["hochiminhcity"] = {
      top: 1010,
      left: 2120,
      neighbours: ["jakarta", "bangkok", "hongkong", "manila"],
      name: "Ho Chi Minh City",
    };
    cities["hongkong"] = {
      top: 790,
      left: 2115,
      neighbours: [
        "hochiminhcity",
        "shanghai",
        "bangkok",
        "kolkata",
        "taipei",
        "manila",
      ],
      name: "Hong Kong",
    };
    cities["taipei"] = {
      top: 765,
      left: 2270,
      neighbours: ["shanghai", "hongkong", "manila", "osaka"],
      name: "Taipei",
    };
    cities["shanghai"] = {
      top: 630,
      left: 2095,
      neighbours: ["beijing", "hongkong", "taipei", "seoul", "tokyo"],
      name: "Shanghai",
    };
    cities["beijing"] = {
      top: 500,
      left: 2085,
      neighbours: ["shanghai", "seoul"],
      name: "Beijing",
    };
    cities["seoul"] = {
      top: 485,
      left: 2255,
      neighbours: ["beijing", "shanghai", "tokyo"],
      name: "Seoul",
    };
    cities["tokyo"] = {
      top: 565,
      left: 2385,
      neighbours: ["seoul", "shanghai", "sanfrancisco", "osaka"],
      name: "Tokyo",
    };
    cities["osaka"] = {
      top: 710,
      left: 2405,
      neighbours: ["taipei", "tokyo"],
      name: "Osaka",
    };

    //
    // set initial viral load
    //
    for (var key in cities) {
      cities[key].virus = {yellow:0, red:0,blue:0,black:0};
    }

    return cities;
  }


  returnInfectionCards() {
    var deck = {};

    deck["sanfrancisco"] = {
      img: "Infection%20Blue%20San%20Francisco.jpg",
      virus: "blue",
    };
    deck["chicago"] = { img: "Infection%20Blue%20Chicago.jpg", virus: "blue" };
    deck["montreal"] = { img: "Infection%20Blue%20Toronto.jpg", virus: "blue" };
    deck["newyork"] = {
      img: "Infection%20Blue%20New%20York.jpg",
      virus: "blue",
    };
    deck["washington"] = {
      img: "Infection%20Blue%20Washington.jpg",
      virus: "blue",
    };
    deck["atlanta"] = { img: "Infection%20Blue%20Atlanta.jpg", virus: "blue" };
    deck["losangeles"] = {
      img: "Infection%20Yellow%20Los%20Angeles.jpg",
      virus: "yellow",
    };
    deck["mexicocity"] = {
      img: "Infection%20Yellow%20Mexico%20City.jpg",
      virus: "yellow",
    };
    deck["miami"] = { img: "Infection%20Yellow%20Miami.jpg", virus: "yellow" };
    deck["bogota"] = {
      img: "Infection%20Yellow%20Bogota.jpg",
      virus: "yellow",
    };
    deck["lima"] = { img: "Infection%20Yellow%20Lima.jpg", virus: "yellow" };
    deck["santiago"] = {
      img: "Infection%20Yellow%20Santiago.jpg",
      virus: "yellow",
    };
    deck["buenosaires"] = {
      img: "Infection%20Yellow%20Buenos%20Aires.jpg",
      virus: "yellow",
    };
    deck["saopaulo"] = {
      img: "Infection%20Yellow%20Sao%20Paulo.jpg",
      virus: "yellow",
    };
    deck["lagos"] = { img: "Infection%20Yellow%20Lagos.jpg", virus: "yellow" };
    deck["khartoum"] = {
      img: "Infection%20Yellow%20Khartoum.jpg",
      virus: "yellow",
    };
    deck["kinshasa"] = {
      img: "Infection%20Yellow%20Kinsasha.jpg",
      virus: "yellow",
    };
    deck["johannesburg"] = {
      img: "Infection%20Yellow%20Johannesburg.jpg",
      virus: "yellow",
    };
    deck["london"] = { img: "Infection%20Blue%20London.jpg", virus: "blue" };
    deck["madrid"] = { img: "Infection%20Blue%20Madrid.jpg", virus: "blue" };
    deck["essen"] = { img: "Infection%20Blue%20Essen.jpg", virus: "blue" };
    deck["paris"] = { img: "Infection%20Blue%20Paris.jpg", virus: "blue" };
    deck["stpetersburg"] = {
      img: "Infection%20Blue%20St.%20Petersburg.jpg",
      virus: "blue",
    };
    deck["milan"] = { img: "Infection%20Blue%20Milan.jpg", virus: "blue" };
    deck["algiers"] = {
      img: "Infection%20Black%20Algiers.jpg",
      virus: "black",
    };
    deck["cairo"] = { img: "Infection%20Black%20Cairo.jpg", virus: "black" };
    deck["istanbul"] = {
      img: "Infection%20Black%20Istanbul.jpg",
      virus: "black",
    };
    deck["moscow"] = { img: "Infection%20Black%20Moscow.jpg", virus: "black" };
    deck["baghdad"] = {
      img: "Infection%20Black%20Baghdad.jpg",
      virus: "black",
    };
    deck["riyadh"] = { img: "Infection%20Black%20Riyadh.jpg", virus: "black" };
    deck["tehran"] = { img: "Infection%20Black%20Tehran.jpg", virus: "black" };
    deck["karachi"] = {
      img: "Infection%20Black%20Karachi.jpg",
      virus: "black",
    };
    deck["mumbai"] = { img: "Infection%20Black%20Mumbai.jpg", virus: "black" };
    deck["delhi"] = { img: "Infection%20Black%20Delhi.jpg", virus: "black" };
    deck["chennai"] = {
      img: "Infection%20Black%20Chennai.jpg",
      virus: "black",
    };
    deck["kolkata"] = {
      img: "Infection%20Black%20Kolkata.jpg",
      virus: "black",
    };
    deck["bangkok"] = { img: "Infection%20Red%20Bangkok.jpg", virus: "red" };
    deck["jakarta"] = { img: "Infection%20Red%20Jakarta.jpg", virus: "red" };
    deck["sydney"] = { img: "Infection%20Red%20Sydney.jpg", virus: "red" };
    deck["manila"] = { img: "Infection%20Red%20Manila.jpg", virus: "red" };
    deck["hochiminhcity"] = {
      img: "Infection%20Red%20Ho%20Chi%20Minh%20City.jpg",
      virus: "red",
    };
    deck["hongkong"] = {
      img: "Infection%20Red%20Hong%20Kong.jpg",
      virus: "red",
    };
    deck["taipei"] = { img: "Infection%20Red%20Taipei.jpg", virus: "red" };
    deck["shanghai"] = { img: "Infection%20Red%20Shanghai.jpg", virus: "red" };
    deck["beijing"] = { img: "Infection%20Red%20Beijing.jpg", virus: "red" };
    deck["seoul"] = { img: "Infection%20Red%20Seoul.jpg", virus: "red" };
    deck["tokyo"] = { img: "Infection%20Red%20Tokyo.jpg", virus: "red" };
    deck["osaka"] = { img: "Infection%20Red%20Osaka.jpg", virus: "red" };

    return deck;
  }
  returnRoleCards() {
    var deck = {};

    deck["osaka"] = { img: "card_osaka.jpg" };

    return deck;
  }

  returnPlayerCards() {
    var deck = {};
    //48 city cards
    deck["sanfrancisco"] = {
      img: "Card%20Blue%20San%20Francisco.jpg",
      name: "San Francisco",
      virus: "blue",
    };
    deck["chicago"] = {
      img: "Card%20Blue%20Chicago.jpg",
      name: "Chicago",
      virus: "blue",
    };
    deck["montreal"] = {
      img: "Card%20Blue%20Toronto.jpg",
      name: "Montreal",
      virus: "blue",
    };
    deck["newyork"] = {
      img: "Card%20Blue%20New%20York.jpg",
      name: "New York",
      virus: "blue",
    };
    deck["washington"] = {
      img: "Card%20Blue%20Washington.jpg",
      name: "Washington",
      virus: "blue",
    };
    deck["atlanta"] = {
      img: "Card%20Blue%20Atlanta.jpg",
      name: "Atlanta",
      virus: "blue",
    };
    deck["london"] = {
      img: "Card%20Blue%20London.jpg",
      name: "London",
      virus: "blue",
    };
    deck["madrid"] = {
      img: "Card%20Blue%20Madrid.jpg",
      name: "Madrid",
      virus: "blue",
    };
    deck["essen"] = {
      img: "Card%20Blue%20Essen.jpg",
      name: "Essen",
      virus: "blue",
    };
    deck["paris"] = {
      img: "Card%20Blue%20Paris.jpg",
      name: "Paris",
      virus: "blue",
    };
    deck["stpetersburg"] = {
      img: "Card%20Blue%20St.%20Petersburg.jpg",
      name: "St. Petersburg",
      virus: "blue",
    };
    deck["milan"] = {
      img: "Card%20Blue%20Milan.jpg",
      name: "Milan",
      virus: "blue",
    };
    deck["losangeles"] = {
      img: "Card%20Yellow%20Los%20Angeles.jpg",
      name: "Los Angeles",
      virus: "yellow",
    };
    deck["mexicocity"] = {
      img: "Card%20Yellow%20Mexico%20City.jpg",
      name: "Mexico City",
      virus: "yellow",
    };
    deck["miami"] = {
      img: "Card%20Yellow%20Miami.jpg",
      name: "Miami",
      virus: "yellow",
    };
    deck["bogota"] = {
      img: "Card%20Yellow%20Bogota.jpg",
      name: "Bogota",
      virus: "yellow",
    };
    deck["lima"] = {
      img: "Card%20Yellow%20Lima.jpg",
      name: "Lima",
      virus: "yellow",
    };
    deck["santiago"] = {
      img: "Card%20Yellow%20Santiago.jpg",
      name: "Santiago",
      virus: "yellow",
    };
    deck["buenosaires"] = {
      img: "Card%20Yellow%20Buenos%20Aires.jpg",
      name: "Buenos Aires",
      virus: "yellow",
    };
    deck["saopaulo"] = {
      img: "Card%20Yellow%20Sao%20Paulo.jpg",
      name: "Sao Paulo",
      virus: "yellow",
    };
    deck["lagos"] = {
      img: "Card%20Yellow%20Lagos.jpg",
      name: "Lagos",
      virus: "yellow",
    };
    deck["khartoum"] = {
      img: "Card%20Yellow%20Khartoum.jpg",
      name: "Khartoum",
      virus: "yellow",
    };
    deck["kinshasa"] = {
      img: "Card%20Yellow%20Kinsasha.jpg",
      name: "Kinshasa",
      virus: "yellow",
    };
    deck["johannesburg"] = {
      img: "Card%20Yellow%20Johannesburg.jpg",
      name: "Johannesburg",
      virus: "yellow",
    };
    deck["algiers"] = {
      img: "Card%20Black%20Algiers.JPG",
      name: "Algiers",
      virus: "black",
    };
    deck["cairo"] = {
      img: "Card%20Black%20Cairo.jpg",
      name: "Cairo",
      virus: "black",
    };
    deck["istanbul"] = {
      img: "Card%20Black%20Istanbul.jpg",
      name: "Istanbul",
      virus: "black",
    };
    deck["moscow"] = {
      img: "Card%20Black%20Moscow.jpg",
      name: "Moscow",
      virus: "black",
    };
    deck["baghdad"] = {
      img: "Card%20Black%20Baghdad.jpg",
      name: "Baghdad",
      virus: "black",
    };
    deck["riyadh"] = {
      img: "Card%20Black%20Riyadh.jpg",
      name: "Riyadh",
      virus: "black",
    };
    deck["tehran"] = {
      img: "Card%20Black%20Tehran.jpg",
      name: "Tehran",
      virus: "black",
    };
    deck["karachi"] = {
      img: "Card%20Black%20Karachi.jpg",
      name: "Karachi",
      virus: "black",
    };
    deck["mumbai"] = {
      img: "Card%20Black%20Mumbai.jpg",
      name: "Mumbai",
      virus: "black",
    };
    deck["delhi"] = {
      img: "Card%20Black%20Delhi.jpg",
      name: "New Delhi",
      virus: "black",
    };
    deck["chennai"] = {
      img: "Card%20Black%20Chennai.jpg",
      name: "Chennai",
      virus: "black",
    };
    deck["kolkata"] = {
      img: "Card%20Black%20Kolkata.jpg",
      name: "Kolkata",
      virus: "black",
    };
    deck["bangkok"] = {
      img: "Card%20Red%20Bangkok.jpg",
      name: "Bangkok",
      virus: "red",
    };
    deck["jakarta"] = {
      img: "Card%20Red%20Jakarta.jpg",
      name: "Jakarta",
      virus: "red",
    };
    deck["sydney"] = {
      img: "Card%20Red%20Sydney.jpg",
      name: "Sydney",
      virus: "red",
    };
    deck["manila"] = {
      img: "Card%20Red%20Manila.jpg",
      name: "Manila",
      virus: "red",
    };
    deck["hochiminhcity"] = {
      img: "Card%20Red%20Ho%20Chi%20Minh%20City.jpg",
      name: "Ho Chi Minh City",
      virus: "red",
    };
    deck["hongkong"] = {
      img: "Card%20Red%20Hong%20Kong.jpg",
      name: "Hong Kong",
      virus: "red",
    };
    deck["taipei"] = {
      img: "Card%20Red%20Taipei.jpg",
      name: "Taipei",
      virus: "red",
    };
    deck["shanghai"] = {
      img: "Card%20Red%20Shanghai.jpg",
      name: "Shanghai",
      virus: "red",
    };
    deck["beijing"] = {
      img: "Card%20Red%20Beijing.jpg",
      name: "Beijing",
      virus: "red",
    };
    deck["seoul"] = {
      img: "Card%20Red%20Seoul.jpg",
      name: "Seoul",
      virus: "red",
    };
    deck["tokyo"] = {
      img: "Card%20Red%20Tokyo.jpg",
      name: "Tokyo",
      virus: "red",
    };
    deck["osaka"] = {
      img: "Card%20Red%20Osaka.jpg",
      name: "Osaka",
      virus: "red",
    };

    //and 5 event cards

    deck["event1"] = {
      img: "Special%20Event%20-%20Airlift.jpg",
      name: "Airlift",
      virus: "",
    };
    deck["event2"] = {
      img: "Special%20Event%20-%20Resilient%20Population.jpg",
      name: "Resilient Population",
      virus: "",
    };
    deck["event3"] = {
      img: "Special%20Event%20-%20One%20Quiet%20Night.jpg",
      name: "One Quiet Night",
      virus: "",
    };
    deck["event4"] = {
      img: "Special%20Event%20-%20Forecast.jpg",
      name: "Forecast",
      virus: "",
    };
    deck["event5"] = {
      img: "Special%20Event%20-%20Government%20Grant.jpg",
      name: "Government Grant",
      virus: "",
    };

    return deck;
  }



  displayOutbreaks() {
    let t = 982 + 80 * this.game.state.outbreaks;
    let l = (this.game.state.outbreaks % 2 ===0) ? 90 : 188;
    
    $(".marker_outbreak").css("top", this.scale(t) + "px");
    $(".marker_outbreak").css("left", this.scale(l) + "px");
  }

  displayDecks() {
    console.log(this.game.deck);
    let html = "";

    for (let i = 0; i < this.game.deck[0].discards.length; i++){
      html += `<img style="bottom:${2*i}px; right:${2*i}px;" src="/pandemic/img/${this.game.deck[0].cards[this.game.deck[0].discards[i]].img}" />`;
    }
    document.querySelector(".infection_discard_pile").innerHTML = html;

    html = "";
    for (let i = 0; i < this.game.deck[1].discards.length; i++){
      html += `<img style="bottom:${2*i}px; right:${2*i}px;" src="/pandemic/img/${this.game.deck[1].cards[this.game.deck[1].discards[i]].img}" />`;
    }
    document.querySelector(".player_discard_pile").innerHTML = html;

    html = "";    
    for (let i = 0; i < this.game.deck[0].crypt.length; i++){
      html += `<img src="/pandemic/img/Back%20Infection.gif" style="bottom:${i}px;right:${i}px"/>`;
    }
    document.querySelector(".back_infection_card").innerHTML = html;

    html = "";
    for (let i = 0; i < this.game.deck[1].crypt.length; i++){
      html += `<img src="/pandemic/img/Back%20Player%20Card.gif" style="bottom:${i}px;right:${i}px"/>`;
    }
    document.querySelector(".back_player_card").innerHTML = html;    

  }

displayDisease() {
  //Move the players off the board so they don't get erased
  for (let p of document.querySelectorAll(".player")){
    document.body.appendChild(p);
  }
    for (var i in this.game.cities) {
      let divname = "#" + i;
      let width = 100;
      let cubedeath = ""; //html for the cubes
      let cubes = 0;
      let colors = 0;
      let color = "";

      for (let v in this.game.state.active){
        if(this.game.cities[i].virus[v] > 0){
          colors++;
          if (this.game.cities[i].virus[v] >= cubes){
            color = v;  
          }
          cubes += this.game.cities[i].virus[v];
        }
      }

      if (colors > 0){
          switch (cubes){
            case 1: 
            cubedeath =
            `<img class="cube" src="/pandemic/img/cube_${color}.png" style="top:${this.scale(10)}px;left:${this.scale(15)}px;"/>`;
              break;
            case 2:
            cubedeath =
            `<img class="cube" src="/pandemic/img/cube_${color}.png" style="top:${this.scale(0)}px;left:${this.scale(35)}px;"/>
             <img class="cube" src="/pandemic/img/cube_${color}.png" style="top:${this.scale(10)}px;left:${this.scale(0)}px;"/>`;
              break;
            case 3:
            cubedeath =
            `<img class="cube" src="/pandemic/img/cube_${color}.png" style="top:-${this.scale(10)}px;left:${this.scale(35)}px;"/>
             <img class="cube" src="/pandemic/img/cube_${color}.png" style="top:${this.scale(0)}px;left:${this.scale(0)}px;"/>
             <img class="cube" src="/pandemic/img/cube_${color}.png" style="top:-${this.scale(30)}px;left:${this.scale(20)}px;"/>`;
              break;
            default: console.error("Cube death");
          }
        if (colors > 1){ //multiple colors
          console.log(`Placed ${this.game.cities[i].virus[color]} cubes of ${color}`);
          cubes -= this.game.cities[i].virus[color];
          console.log(`${cubes} cubes from ${colors-1} other colors to place`);
          let startTop = 30;
          let startLeft = 30;
          if (cubes > 1){
            startTop = 20;
            startLeft = 70;
          }
         for (let v in this.game.cities[i].virus){
          console.log(v);
           if (v !== color && this.game.cities[i].virus[v]>0){
            for (let j = 0; j < this.game.cities[i].virus[v]; j++){
              cubedeath += `<img class="cube" src="/pandemic/img/cube_${v}.png" style="top:${this.scale(startTop)}px;left:${this.scale(startLeft)}px;"/>`;
              startLeft -= 40;
              startTop += 10;
            }
           }
         }
        }
      }
       document.querySelector(divname).innerHTML = cubedeath;
    }
  }

  displayVials() {
    let w = 82;
    let h = 102;

    $(".vial").css("top", this.scale(1703) + "px");
    $(".vial").css("opacity", "0.6");
    $(".vial_yellow").css("left", this.scale(816) + "px");
    $(".vial_red").css("left", this.scale(940) + "px");
    $(".vial_blue").css("left", this.scale(1068) + "px");
    $(".vial_black").css("left", this.scale(1182) + "px");

    for (let v in this.game.state.cures){
      if (this.game.state.cures[v]){
        let div = ".vial_"+v;
        $(div).css("top", this.scale(1570) + "px");
        $(div).css("opacity", "1");
        if (this.isEradicated(v)){
          let virus_string = v.charAt(0).toUpperCase()+v.slice(1);
          console.log(virus_string);
          $(div).css("background-image",
              `url("/pandemic/img/Vial%20${virus_string}%20Eradicated.png")`
            );
        }
      }
    }
  }

  definePlayersPawns(){
    for (let i = 0; i < this.game.players_info.length; i++) {
      let player = document.getElementById(`player${i+1}`);
      if (!player){
        console.error("player undefined in DOM");
        return;
      }
      //player.style.backgroundImage = `url("/pandemic/img/${this.game.players_info[i].pawn}")`;
      let title = `${this.game.players_info[i].role}`;
      if (this.game.player == i+1){
        title += " (me)";
      }

      player.title = title;
      player.style.display = "inline-block";
      //player.style.left = this.scale(33*i)+"px";
      player.innerHTML = `<img src="/pandemic/img/${this.game.players_info[i].pawn}"/>`;
    }
  }

  displayPlayers() {
    for (let i = 0; i < this.game.players_info.length; i++) {
      let city = document.getElementById(this.game.players_info[i].city);
      let player = document.getElementById(`player${i+1}`);
      if (city && player){
        city.appendChild(player);
      }
    }
  }

  displayResearchStations() {
    for (let i = 0; i < this.game.state.research_stations.length; i++) {
      let divname = ".research_station" + (i + 1);

      let city = this.game.state.research_stations[i];

      let t = this.game.cities[city].top + 25;
      let l = this.game.cities[city].left + 25;

      $(divname).css("top", this.scale(t) + "px");
      $(divname).css("left", this.scale(l) + "px");
      $(divname).css("display", "block");
    }
  }

  displayInfectionRate() {
    let t = 350;
    let l = 1650 + 95* this.game.state.infection_rate;
    
    $(".marker_infection_rate").css("top", this.scale(t) + "px");
    $(".marker_infection_rate").css("left", this.scale(l) + "px");
  }

  showBoard() {
    if (this.browser_active == 0) {
      return;
    }
    this.displayInfectionRate();
    this.displayOutbreaks();
    this.displayDisease();
    this.displayPlayers();
    this.displayResearchStations();

    this.displayDecks();
    this.displayVials();
  }

  /*Need to overwrite returnCardList because Pandemic stores hands in a public variable, not the internal deck.hand*/
  returnCardList(cardarray = [], cardtype = this.defaultDeck) {
    if (cardarray.length == 0) {
      cardarray = this.game.players_info[this.game.player - 1].cards;
    }

    return super.returnCardList(cardarray, cardtype);
  }

  returnCardImage(cardname, ctype = this.defaultDeck) {
    //console.log(cardname,ctype);
    //console.log(this.game.deck)
    let c = this.game.deck[ctype].cards[cardname];
    if (c == undefined || c == null || c === "") {
      return null;
    }

    return `<img class="cardimg" src="/pandemic/img/${c.img}" />`;
  }

  /* Remove the specified card from the specified player's hand*/
  removeCardFromHand(plyr, card) {
    let player = this.game.players_info[plyr - 1];
    let cards = player.cards;

    //this.game.state.player_topcard = card;
    this.game.deck[1].discards.push(card);

    for (let i = 0; i < cards.length; i++) {
      if (cards[i] == card) {
        cards.splice(i, 1);
        return;
      }
    }
  }

  returnGameRulesHTML() {
    return `<div class="rules-overlay">
            <h1>Pandemic</h1>
            <p>Four novel viruses are quickly spreading throughout the world and it is up to you and your teammates to find the cure in this fast paced cooperative board game.</p>
            <h2>Roles</h2>
            <p>Each player has a role, which gives them a special ability: </p>
            <table>
            <tbody>
            <tr><th>Medic</th><td>The medic removes <em>all</em> cubes of one color. When a cure has been found, the Medic removes cubes simply by being in the city, without using an action.</td></tr>
            <tr><th>Operations Expert</th><td>The operations expert may build a research station in the current city without discarding a card -or- discard any card when in a city with a research station to move anywhere in the world.</td></tr>
            <tr><th>Scientist</th><td>The scientist only needs four cards of the same color to discover the cure for a disease.</td></tr>
            </tbody></table>
            <h2>Game Play</h2>
            <p>Each player has four actions per turn, which may be used to MOVE to a new city, CURE diseases in the current city, RESEARCH a cure for a disease, BUILD a research station, or SHARE knowledge</p>
            <table>
            <tr><th>Move</th><td><ul>
                  <li><strong>Drive/Ferry</strong> -- Players can move from city to city by ground transportation by following the connecting lines on the board map. Each segment requires one action.</li>
                  <li><strong>Shuttle Flight</strong> -- Players may move from one city with a research station to another city with a research station as an action</li>
                  <li><strong>Direct Flight</strong> -- Players may discard a card from their hand to move to the city listed on the card</li>
                  <li><strong>Charter Flight</strong> -- A player may discard the card with the city matching their current location to move to any city on the board</li>
                  </ul></td></tr>
            <tr><th>Cure disease</th><td>A player may remove one cube of any color in their current city as an action. Once a cure for the disease has been discovered, they may remove all cubes of that color with one action.</td></tr>
            <tr><th>Reseach a cure</th><td>At a city with a research station, players may discard five cards of the same color to discover the cure for that disease.</td></tr>
            <tr><th>Build a research station</th><td>Players may discard the card matching the city of their current location in order to build a new research station in that city. Only six research stations may exist in the globe, so if the limit is reached, the player may chose an old station to remove.</td></tr>
            <tr><th>Share knowldge</th><td>If two players are in the same city and one of them holds the card matching that city, they may share knowledge. In which case, the player may give or receive the card (as appropriate) as an action.</td></tr>
            </table>
            <p>After the player finishes their four actions, they draw two additional player cards. Players may not have more than 7 cards in their hand at any time and must immediately discard any extra cards. Most cards are city cards, though some are EVENT cards which may be played at any time and do not count as an action. There are also EPIDEMIC cards shuffled into the deck. EPIDEMICS increase the virulence of the diseases</p>
            <h2>Infection and Outbreaks</h2>
            <p>Before then next player goes, 2-4 additional cities are infected with new disease cubes. Cites can hold up to 3 disease cubes (of a given color), afterwhich an OUTBREAK occurs. During an outbreak, all neigboring cities get one cube of that disease's color. This can lead to chain reactions of outbreaks.</p>
            <h2>Victory and Defeat</h2>
            <p>If the players discover the cures to all four diseases, then they are victorious. However, they are in a race against time. The players lose upon the 8th OUTBREAK, if the deck of player cards runs out, or if any disease exceeds more than 24 cubes on the board.</p>
            </div>`;
  }

  returnGameOptionsHTML() {
    let player_upper_limit = this.maxPlayers;
    try {
      player_upper_limit = document.querySelector(
        ".game-wizard-players-select"
      ).value;
    } catch (err) {}

    let html = `
      <h1 class="overlay-title">Pandemic Options</h1>
        <div class="overlay-input">
          <label for="difficulty">Difficulty:</label>
          <select name="difficulty">
            <option value="4">easy</option>
            <option value="5" selected default>not so easy</option>
            <option value="6">damn hard</option>
          </select>
        </div>
      
    `;

    for (let i = 1; i <= player_upper_limit; i++) {
      html += `
            <div class="overlay-input">
            <label for="player${i}" class="game-players-options game-players-options-${i}p">Player ${i}:</label>
            <select name="player${i}" id="game-players-select-${i}p" class="game-players-options game-players-options-${i}p">
              <option value="random" selected default>random</option>
              <option value="generalist">generalist</option>
              <option value="scientist">scientist</option>
              <option value="medic">medic</option>
              <option value="operationsexpert">operations expert</option>
            </select>
            </div>
       `;
    }

    html += `
     
     <div id="game-wizard-advanced-return-btn" class="game-wizard-advanced-return-btn button">accept</div>
    `;

    return html;
  }

  returnQuickLinkGameOptions(options) {
    let new_options = {};
    let player1 = "";
    let player2 = "";

    for (var index in options) {
      if (index == "player1") {
        player1 = options[index];
      }
      if (index == "player2") {
        player2 = options[index];
      }
    }

    for (var index in options) {
      new_options[index] = options[index];
    }
    new_options["player1"] = player2;
    new_options["player2"] = player1;

    return new_options;
  }

  returnEpidemicOverlay(city) {
    let html = `
      <div class="epidemic_overlay">
        <h1>Epidemic in ${this.game.cities[city].name}!!!</h1>
        <div class="epidemic-card">
          <img src="/pandemic/img/Epidemic.jpg"/>
        </div>
        <div class="button close_epidemic_overlay" id="close_epidemic_overlay">close</div>
      </div>
    `;

    return html;
  }

  returnWelcomeOverlay() {
    let html = `<div class="welcome_overlay">`;

    for (let i = 0; i < this.game.players_info.length; i++) {
      let player = this.game.players_info[i];
      let cards_overview = "";
      let deck = player.cards;

      for (let i = 0; i < deck.length; i++) {
        let city = this.game.deck[1].cards[deck[i]];
        if (i > 0) {
          cards_overview += ", ";
        }
        cards_overview += city.name;
      }

      html += `
        <div class="player_info_box">
          <div class="player_role_card">
            <img src="/pandemic/img/${player.card}" />
          </div>
          <div class="player_role_description">
            <table>
              <tr>
                <td class="player_role_description_header">Player ${
                  i + 1
                }: </td>
                <td>${this.app.keys.returnUsername(this.game.players[i])}</td>
              </tr>
              <tr>
                <td class="player_role_description_header">Role: </td>
                <td>${player.role}</td>
              </tr>
              <tr>
                <td class="player_role_description_header">Description: </td>
                <td>${player.desc}</td>
              </tr>
              <tr>
                <td class="player_role_description_header">Cards: </td>
                <td>${cards_overview}</td>
              </tr>
            </table>
          </div>
        </div>
      `;
    }

    html += `
        <div class="button close_welcome_overlay" id="close_welcome_overlay">Start Playing</div>
      </div>`;

    return html;
  }
}
module.exports = Pandemic;
