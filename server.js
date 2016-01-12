"use strict";

// find better way to do this
var idCounter = 0;

// load card data from external file - there might be a better way to do this
var cards;
var fs = require("fs");
eval(fs.readFileSync("./public/cards.js", "utf8"));

// initialize game variables
var gameStart = false;
var gameState = {
    phase: "action",
    players: {},
    board: [],
    trash: [],
    activePlayer: 0, // !! figure out a some way to determine who starts (rather than just first connected)
    playerOrder: [],
};

function Player(id, deck) {
    this.id = id;
    this.hand = [];
    this.discard = [];
    this.play = [];
    this.deck = deck;
    this.coins = 0;
    this.actions = 1;
    this.buys = 1;
}

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
        // !! need to validate active player
        endTurn(gameState.players[socket.id]);
        gameState.activePlayer = (gameState.activePlayer + 1) % gameState.playerOrder.length;

        io.sockets.emit("gameState", gameState);
    });
    socket.on("buy", function(data) {
        // need to validate active player
        var player = gameState.players[socket.id];
        var card = cards[data.cardID];
        if (player.coins >= card.cost && player.buys > 0) {
            io.sockets.emit("log", player.id + " buys " + card.name);
            gameState.phase = "buy";
            player.coins -= card.cost;
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
            player.play.push(player.hand[data.cardIndex]);
            player.hand.splice(data.cardIndex, 1);
            card.action(player);
            io.sockets.emit("gameState", gameState);
        }
        if (card.type.indexOf("treasure") >= 0) {
            io.sockets.emit("log", player.id + " plays " + card.name);
            gameState.phase = "buy";
            player.play.push(player.hand[data.cardIndex]);
            player.hand.splice(data.cardIndex, 1);
            card.action(player);
            io.sockets.emit("gameState", gameState);
        }
    });
    socket.on("startGame", function() {
        gameStart = true;
        io.sockets.emit("log", "game started");

        // initialize board
        // select 10 random action cards
        gameState.board = initBoard();

        // !! <DEBUG> Put all cards into play. Delete this section later.
        gameState.board = [];
        for (var key in cards) {
            gameState.board.push(cards[key]);
        }
        gameState.playerOrder = [];
        gameState.players = {};
        gameState.trash = [];
        for (var id in io.sockets.clients().sockets) {
            var startingHand = [];
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(1));
            startingHand.push(createCard(4));
            startingHand.push(createCard(4));
            startingHand.push(createCard(4));

            gameState.players[id] = new Player(id, startingHand);

            shuffle(gameState.players[id].deck);
            draw(gameState.players[id], 5);
            gameState.playerOrder.push(id);
        }

        io.sockets.emit("gameState", gameState);
    });
    socket.on("select", function(data) {
        // need to validate active player
        gameState.queryData.callback(data);
    });
    socket.on("callback", function(data) {
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
    player.coins = 0;
    clear(player);
    draw(player, 5);
    gameState.phase = "action";
    io.sockets.emit("log", gameState.players[gameState.playerOrder[gameState.activePlayer]].id + "'s turn");
}

function initBoard() {
    var treasureCards = [];
    var victoryCards = [];
    var curseCards = [];
    var actionCards = [];
    for (var key in cards) {
        switch (cards[key].type) {
            case "treasure":
                treasureCards.push(cards[key]);
                break;
            case "victory":
                victoryCards.push(cards[key]);
                break;
            case "curse":
                curseCards.push(cards[key]);
                break;
            case "action":
                actionCards.push(cards[key]);
                break;
        }
    }
    treasureCards.sort(sortCost);
    victoryCards.sort(sortCost);
    curseCards.sort(sortCost);

    shuffle(actionCards);
    actionCards = actionCards.splice(0, 10);
    actionCards.sort(sortCost);

    return treasureCards.concat(victoryCards, curseCards, actionCards);
}

function sortCost(a, b) {
    return a.cost > b.cost;
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
            player.hand.push(card);
        }
        actualDrawn++;
        numCards--;
    }

    io.sockets.emit("log", player.id + " draws " + actualDrawn + " cards");
}

function clear(player) {
    while (player.hand.length > 0) {
        var card = player.hand.pop();
        player.discard.push(card);
    }
    while (player.play.length > 0) {
        var card = player.play.pop();
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
