Packs = new Mongo.Collection("packs");
CardPool = new Mongo.Collection("card_pool");
Decks = new Mongo.Collection("decks");
Games = new Mongo.Collection("games");

if (Meteor.isClient) {
  Meteor.subscribe("activeUsers");
  Meteor.subscribe("packs");
  Meteor.subscribe("decks");
  Meteor.subscribe("games");
  Meteor.subscribe("cardPool");

  Template.body.helpers({
    users: function() {
      return Meteor.users.find({});
    },
    packs: function() {
      return Packs.find({});
    },
    decks: function() {
      return Decks.find({});
    },
    game: function() {
      return Games.findOne({});
    },
    myPack: function() {
      return Packs.findOne({owner: Meteor.user().username});
    },
    myDeck: function() {
      return Decks.findOne({owner: Meteor.user().username});
    }
  });

  Template.body.events({
    "click .card": function (event) {
      target = $(event.target);
      if (!target.hasClass("disabled")) {
        $("a.card").addClass("disabled");
        index = target.data("index");
        pack = Packs.findOne({owner: Meteor.user().username});
        deck = Decks.findOne({owner: Meteor.user().username});
        card = _.detect(pack.cards, function(el) { return el.index == index })
        newPackCards = _.without(pack.cards, card);
        newDeckCards = deck.cards.concat(card);
        Packs.update({_id: pack._id}, {$set: {cards: newPackCards}});
        Decks.update({_id: deck._id}, {$set: {cards: newDeckCards}});

        game = Games.findOne({});

        cardsLeft = newPackCards.length;
        console.log(cardsLeft, game.pack);
        if (_.all(Packs.find({}).fetch(), function(pack) { return pack.cards.length == cardsLeft })) {
          if (cardsLeft == 0 && game.pack < 3) {
            // next pack
            nextPack();
          }
          else if (cardsLeft == 0 && game.pack == 3) {
            // end game
            $("a#download").css("display", "block");
            Games.update({_id: game._id}, {$set: {status: "finished"}});
          }
          else {
            // next card
            rotate(1);
            Games.update({_id: game._id}, {$inc: {card: 1}});
          }
          $("a.card").removeClass("disabled");
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
    var pom = $("#download");
    username = Meteor.user().username;
    deck = Decks.findOne({owner: username});
    text = "";
    _.forEach(deck.cards, function(card) {text += card.definition; text += "\n"});
    pom.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.attr('download', username + ".cdf");
    pom.click();
    return false;
  }

  nextPack = function() {
    game = Games.findOne({});
    Games.update({_id: game._id}, {$inc: {pack: 1}, $set: {card: 1}});
    _.each(game.users, function(user) {
      _(3).times(function(step) {
        pack = Packs.findOne({owner: user.username});
        rand = _.random(0, CardPool.find({}).count() - 1);
        card = CardPool.find({}).fetch()[rand];
        Packs.update({_id: pack._id}, {$set: {cards: pack.cards.concat(card)}});
        CardPool.remove(card._id);
      });
    });
  }
}

if (Meteor.isServer) {
  Meteor.startup(function() {
    if (CardPool.find({}).count() == 0) {
      Games.insert({pack: 0, card: 0, users: [], status: "unstarted"});
      _(26).times(function(step, times) {
        CardPool.insert({
          definition: String.fromCharCode(65 + step)
        })
      });
    }
  });

  Meteor.publish("activeUsers", function() {
    return Meteor.users.find({"status.online": true}, {fields: {gameStatus: 1, username: 1, profile: 1}});
  });

  Meteor.publish("packs", function() {
    return Packs.find({}, {fields: {cards: 1, owner: 1}});
  });

  Meteor.publish("decks", function() {
    return Decks.find({}, {fields: {cards: 1, owner: 1}});
  });

  Meteor.publish("games", function() {
    return Games.find({}, {fields: {pack: 1, card: 1, status: 1, users: 1}});
  });

  Meteor.publish("cardPool", function() {
    return CardPool.find({}, {fields: {definition: 1}});
  });

  Accounts.onCreateUser(function(options, user) {
    Packs.insert({
      cards: [],
      owner: options.username
    });
    Decks.insert({
      cards: [],
      owner: options.username
    });

    game = Games.findOne({});
    Games.update({_id: game._id}, {$set: {users: game.users.concat(user)}});

    if (game.users.length == 4) {
      nextPack();
    }

    return user;
  });
}
