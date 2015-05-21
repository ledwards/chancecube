Packs = new Mongo.Collection("packs");
CardPool = new Mongo.Collection("card_pool");
Decks = new Mongo.Collection("decks");
Games = new Mongo.Collection("games");

Games.current = function() {
  name = window.location.pathname.slice(1);
  if (name == "") {
    game = null;
  }
  else {
    game = Games.findOne({name: name});
  }
  return game;
}

defaultRules = {
  players: 4,
  packs: 3,
  packSize: 15
}

debugRules = {
  players: 2,
  packs: 2,
  packSize: 1
}

if (Meteor.isClient) {
  Meteor.subscribe("activeUsers");
  Meteor.subscribe("packs");
  Meteor.subscribe("decks");
  Meteor.subscribe("cardPool");
  Meteor.subscribe("games", function(){
    findOrCreateGame();
    if (Meteor.user()) {
      initUser();
    }
  });

  Meteor.startup(function () {
  });

  Template.body.helpers({
    message: function() {
      if (Games.current()) {
        Games.findOne({name: Games.current().name}); // needed for update to run
        if (game.users.length < game.rules.players) {
          return "Waiting on more players to join. Need " + game.rules.players
        }
      }
      return "";
    },
    disabled: function() {
      if (Games.current()) {
        game = Games.findOne({name: Games.current().name}); // needed for update to run
        if (game.users.length < game.rules.players) {
          return "disabled";
        }
      }
      return "";
    },
    users: function() {
      if (Games.current()) {
        return _.map(Games.current().users, function(username) { return Meteor.users.findOne({username: username}) });
      }
    },
    packs: function() {
      if (Games.current()) {
        return Packs.find({game: Games.current().name});
      }
    },
    decks: function() {
      if (Games.current()) {
        return Decks.find({game: Games.current().name});
      }
    },
    game: function() {
      return Games.current();
    },
    myPack: function() {
      if (Games.current() && Meteor.user()) {
        return Packs.findOne({owner: Meteor.user().username, game: Games.current().name});
      }
    },
    myDeck: function() {
      if (Games.current() && Meteor.user()) {
        return Decks.findOne({owner: Meteor.user().username, game: Games.current().name});
      }
    }
  });

  Template.body.events({
    "click .card": function (event) {
      target = $(event.target);
      pack = $("ol#pack");
      if (!pack.hasClass("disabled")) {
        $("ol#pack").addClass("disabled");
        id = target.data("id");
        game = Games.current();
        pack = Packs.findOne({game: game.name, owner: Meteor.user().username});
        deck = Decks.findOne({game: game.name, owner: Meteor.user().username});
        card = _.detect(pack.cards, function(el) { return el._id == id });
        newPackCards = _.without(pack.cards, card);
        newDeckCards = deck.cards.concat(card);
        Packs.update({_id: pack._id}, {$set: {cards: newPackCards}});
        Decks.update({_id: deck._id}, {$set: {cards: newDeckCards}});

        cardsLeft = newPackCards.length;
        if (_.all(Packs.find({game: game.name}).fetch(), function(pack) { return pack.cards.length == cardsLeft })) {
          if (cardsLeft == 0 && game.pack < game.rules.packs) {
            // next pack
            nextPack();
          }
          else if (cardsLeft == 0 && game.pack == game.rules.packs) {
            // end game
            Games.update({_id: game._id}, {$set: {status: "finished"}});
          }
          else {
            // next card
            rotate(1);
            Games.update({_id: game._id}, {$inc: {card: 1}});
          }
          $("ol#pack").removeClass("disabled");
        }
      }
      return false;
    },

    "click #download": function (event) {
      download();
      return false;
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

  Accounts.onLogin(function() {
    initUser();
  });

  findOrCreateGame = function(){
    name = window.location.pathname.slice(1);
    if (name != "") {
      game = Games.findOne({name: name});
      if (game == undefined) {
        Games.insert({name: name, pack: 1, card: 1, users: [], status: "unstarted", rules: debugRules});
        _(26).times(function(step, times) {
          CardPool.insert({
            game: name,
            definition: String.fromCharCode(65 + step)
          })
        });
      }
    }
  }

  var initUser = function() {
    if (Games.current() && Games.current().users.indexOf(Meteor.user().username) == -1) {
      joinGame(Games.current());
    }
  }

  rotate = function(mod) {
    // Treat list of Users as an ordered list of players going clockwise.
    // Rotating clockwise means setting the owner of each pack to the user after them in the list
    owners = Packs.find({}).map(function(el){ return el.owner });
    i = 0;
    packs = Packs.find({}).forEach(function(el){
      length = Packs.find({}).count();
      newOwner = owners[(i + length - mod) % length];
      Packs.update({_id: el._id}, {$set: {owner: newOwner}});
      i++;
    });
  }

  download = function() {
    var pom = $("#download a");
    username = Meteor.user().username;
    deck = Decks.findOne({game: Games.current().name, owner: username});
    text = "";
    _.forEach(deck.cards, function(card) {text += card.definition; text += "\n"});
    pom.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.attr('download', username + ".cdf");
    pom.click();
    return false;
  }

  nextPack = function() {
    game = Games.current();
    Games.update({_id: game._id}, {$inc: {pack: 1}, $set: {card: 1}});
    _.each(game.users, function(username) {
      nextPackForUser(username, game);
    });
  }

  nextPackForUser = function(username, game) {
    _(game.rules.packSize).times(function(step) {
      pack = Packs.findOne({game: game.name, owner: username});
      rand = _.random(0, CardPool.find({game: game.name}).count() - 1);
      card = CardPool.find({game: game.name}).fetch()[rand];
      newCards = pack.cards.concat(card);
      Packs.update({_id: pack._id}, {$set: {cards: newCards}});
      CardPool.remove(card._id);
    });
  }

  joinGame = function(game) {
    user = Meteor.user();
    Packs.insert({
      cards: [],
      owner: user.username,
      game: game.name
    });
    Decks.insert({
      cards: [],
      owner: user.username,
      game: game.name
    });

    Games.update({_id: game._id}, {$set: {users: game.users.concat(user.username)}});
    nextPackForUser(user.username, game);
  }
}

if (Meteor.isServer) {
  Meteor.startup(function() {
  });

  Meteor.publish("activeUsers", function() {
    return Meteor.users.find({"status.online": true}, {fields: {gameStatus: 1, username: 1, profile: 1}});
  });

  Meteor.publish("packs", function() {
    return Packs.find({}, {fields: {game: 1, cards: 1, owner: 1}});
  });

  Meteor.publish("decks", function() {
    return Decks.find({}, {fields: {game: 1, cards: 1, owner: 1}});
  });

  Meteor.publish("games", function() {
    return Games.find({}, {fields: {name: 1, pack: 1, card: 1, status: 1, users: 1, rules: 1}});
  });

  Meteor.publish("cardPool", function() {
    return CardPool.find({}, {fields: {game: 1, definition: 1}});
  });
}
