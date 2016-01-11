"use strict";
var app = angular.module("Dominion", ["ngAnimate"]);
var cards;
app.run(function($rootScope) {
    var socket = io.connect();
    var playerID;
    $rootScope.gameState = {};
    $rootScope.cards = cards;
    $rootScope.physicalCards = [];
    socket.on("log", function(msg) {
        $("#output").prepend("<br/>" + msg);
    });
    socket.on("gameState", function(update) {
        $rootScope.you = {
            id: "/#" + socket.id
        };
        playerID = "/#" + socket.id;
        $rootScope.gameState = update;
        $rootScope.clientPlayer = $rootScope.gameState.players[playerID];

        // UI stuff
        /*$rootScope.physicalCards = [];
        for (var playerID in $rootScope.gameState.players) {
            var player = $rootScope.gameState.players[playerID];
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.hand);
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.deck);
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.discard);
        }*/
        // end UI stuff

        // apply gameState changes to UI
        $rootScope.$apply();

        // Prompt Current Player for a Selection
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        if ($rootScope.gameState.phase === "select") {
            $(".card").removeClass("selectable");
            $(".select.button").hide();
            setTimeout(function() {
                $($rootScope.gameState.queryData.eligible).addClass("selectable");
            }, 100);
            if (!$rootScope.gameState.queryData.exact) $(".select.button").show();
        }
        if ($rootScope.gameState.phase === "choose") {

        }

    });
    $rootScope.endTurn = function() {
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        socket.emit("endTurn", {});
    };
    $rootScope.choose = function(index, event) {
        if ($(event.target).hasClass("choosable")) {
            $rootScope.gameState.queryData.selected.push(index);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                socket.emit("callback", $rootScope.gameState.queryData.selected);
            }
        }
    }
    $rootScope.select = function(card, index, zone, event) { // user clicked on a card
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;

        if ($rootScope.gameState.phase === "action" && zone == "hand") {
            socket.emit("action", {
                cardID: card.id,
                cardIndex: index,
                playerID: playerID
            });
        }
        if (($rootScope.gameState.phase === "action" || $rootScope.gameState.phase === "buy") && zone == "buy") {
            socket.emit("buy", {
                cardID: card.id,
                playerID: playerID
            });
        }

        // event.target will get caught by foreground images thus blocking the correct click event
        if ($rootScope.gameState.phase === "select" && $(event.target).hasClass("selectable")) {
            if ($rootScope.gameState.queryData.unique === true) {
                $(event.target).removeClass("selectable");
            }
            var data = {
                card: card,
                index: index,
                zone: zone,
            };
            $rootScope.gameState.queryData.selected.push(data);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                socket.emit("select", $rootScope.gameState.queryData.selected);
            }
        }
    };
    $rootScope.startGame = function() {
        $(".start.button").hide();
        socket.emit("startGame");
    };
    $rootScope.submit = function() {
        socket.emit("select", $rootScope.gameState.queryData.selected);
    };
});
