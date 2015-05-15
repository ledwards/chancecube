Packs = new Mongo.Collection("packs");
CardPool = new Mongo.Collection("card_pool");
Decks = new Mongo.Collection("decks");

if (Meteor.isClient) {
  Meteor.subscribe("activeUsers");
  Meteor.subscribe("packs");
  Meteor.subscribe("decks");

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
    myPack: function() {
      return Packs.findOne({owner: Meteor.user().username});
    },
    myDeck: function() {
      return Decks.findOne({owner: Meteor.user().username});
    }
  });

  Template.body.events({
    "click .card": function (event) {
      index = $(event.target).data("index");
      pack = Packs.findOne({owner: Meteor.user().username});
      deck = Decks.findOne({owner: Meteor.user().username});
      card = _.detect(pack.cards, function(el) { return el.index == index })
      newPackCards = _.without(pack.cards, card);
      newDeckCards = deck.cards.concat(card);
      Packs.update({_id: pack._id}, {$set: {cards: newPackCards}});
      Decks.update({_id: deck._id}, {$set: {cards: newDeckCards}});
      return false;
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });
}

if (Meteor.isServer) {
  Meteor.startup(function() {
    if (CardPool.find({}).count() == 0) {
      _(26).times(function(step, times) {
        CardPool.insert({
          index: step,
          definition: String.fromCharCode(65 + step)
        })
      });
    }
  });

  Meteor.publish("activeUsers", function() {
    return Meteor.users.find({"status.online": true}, {fields: {username: 1, profile: 1}});
  });

  Meteor.publish("packs", function() {
    return Packs.find({}, {fields: {cards: 1, owner: 1}});
  });

  Meteor.publish("decks", function() {
    return Decks.find({}, {fields: {cards: 1, owner: 1}});
  });

  Accounts.onCreateUser(function(options, user) {
    packCount = Packs.find({}).count();
    Packs.insert({
      cards: [],
      owner: options.username
    });
    Decks.insert({
      cards: [],
      owner: options.username
    });

    _(4).times(function(step) {
      pack = Packs.findOne({owner: options.username});
      rand = _.random(0, CardPool.find({}).count() - 1);
      card = CardPool.find({}).fetch()[rand];
      Packs.update({_id: pack._id}, {$set: {cards: pack.cards.concat(card)}});
      CardPool.remove(card._id);
    });
    return user;
  });

  rotate = function() {
    // Treat list of Users as an ordered list of players going clockwise.
    // Rotating clockwise means setting the owner of each pack to the user after them in the list
  }
}
