"use strict";

// find better way to do this
var idCounter = 0;

// load card data from external file - there might be a better way to do this
var cards;
var fs = require("fs");
eval(fs.readFileSync("./public/cards.js", "utf8"));

var gameStart = false;
var gameState = {
    phase: "action",
    players: {},
    board: [],
    trash: [],
};

// start the server
var express = require("express");
var path = require("path");
var app = express();
app.use(express.static(path.join(__dirname, "public")));
var server = require("http").createServer(app).listen(process.env.PORT || 8081);
var io = require("socket.io").listen(server);

// listen for connections
io.sockets.on("connection", function(socket) {
    io.sockets.emit("log", socket.id + " connected"); 
    socket.on("endTurn", function() {
        // need to validate active player
        endTurn(gameState.players[socket.id]);
        io.sockets.emit("gameState", gameState);
    });
    socket.on("buy", function(data) {
        // need to validate active player
        var player = gameState.players[socket.id];
        var card = cards[data.cardID];
        if (player.treasure >= card.cost && player.buys > 0) {
            io.sockets.emit("log", player.id + " buys " + card.name);
            gameState.phase = "buy";
            player.treasure -= card.cost;
            player.buys--;
            player.actions = 0;
            var newCard = createCard(data.cardID);
            player.discard.push(newCard);
            io.sockets.emit("gameState", gameState);
        }
    });
    socket.on("action", function(data) {
        // need to validate active player
        var player = gameState.players[socket.id];
        var card = cards[data.cardID];
        if (player.actions > 0 && card.type.indexOf("action") >= 0) {
            io.sockets.emit("log", player.id + " plays " + card.name);
            player.actions--;
            card.action(player);
            player.discard.push(player.hand[data.cardIndex]);
            player.hand.splice(data.cardIndex, 1);
            io.sockets.emit("gameState", gameState);
        }
    });
    socket.on("startGame", function() {
        gameStart = true;
        io.sockets.emit("log", "game started");

        // initialize board
        gameState.board = [];
        for (var key in cards) {
            gameState.board.push(cards[key]);
        }

        gameState.players = {};
        for (var id in io.sockets.clients().sockets) {
            var deck = [];
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(1));
            deck.push(createCard(4));
            deck.push(createCard(4));
            deck.push(createCard(4));

            gameState.players[id] = {
                id: id,
                hand: [],
                discard: [],
                play: [],
                deck: deck,
                treasure: 0,
                bonusTreasure: 0,
                actions: 1,
                buys: 1
            };
            shuffle(gameState.players[id].deck);
            draw(gameState.players[id], 5);
            gameState.activePlayer = id;
        }
        io.sockets.emit("gameState", gameState);
    });
    socket.on("select", function(data) {
        // need to validate active player
        gameState.queryData.callback(data);
    });
    socket.on("disconnect", function() {
        io.sockets.emit("message", {
            msg: socket.id,
            id: "server : disconnect"
        });
    });
});

// utility functions
function generateID() {
    return idCounter++;
}

function createCard(id) {
    var newCard = {};
    newCard.id = id;
    newCard.uid = generateID();
    return newCard;
}

function endTurn(player) {
    io.sockets.emit("log", player.id + " ends their turn");
    player.actions = 1;
    player.buys = 1;
    player.bonusTreasure = 0;
    discard(player);
    draw(player, 5);
    gameState.phase = "action";
}

function countTreasure(player) {
    var treasure = player.bonusTreasure;
    for (var i = 0; i < player.hand.length; i++) {
        treasure += cards[player.hand[i].id].value;
    }
    return treasure;
}

function draw(player, numCards) {
    var actualDrawn = 0;
    while (numCards > 0) {
        if (player.deck.length === 0) {
            io.sockets.emit("log", player.id + " draws " + actualDrawn + " cards");
            actualDrawn = 0;
            reload(player);
        }
        if (player.deck.length > 0) {
            var card = player.deck.pop();
            // card.animation = "deck-to-hand";
            player.hand.push(card);
        }
        actualDrawn++;
        numCards--;
    }

    player.treasure = countTreasure(player);
    io.sockets.emit("log", player.id + " draws " + actualDrawn + " cards");
}

function discard(player) {
    while (player.hand.length > 0) {
        var card = player.hand.pop();
        // card.animation = "hand-to-discard";
        player.discard.push(card);
    }
}

function reload(player) {
    while (player.discard.length > 0) {
        player.deck.push(player.discard.pop());
    }
    shuffle(player.deck);
    io.sockets.emit("log", player.id + " shuffles their discard pile into their deck");
}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}
