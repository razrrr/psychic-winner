"use strict";
var app = angular.module("Dominion", ["ngAnimate"]);
var cards;
app.run(function($rootScope) {
    var socket = io.connect();
    var playerID;
    $rootScope.gameState = {
        playerOrder: []
    };
    $rootScope.cards = cards;
    $rootScope.clientPlayer = {};

    for (var id in cards) {
        cards[id].id = id;
    }
    $rootScope.$watch("clientPlayer.coins", function() {
        $(".buyable .card").addClass("disabled");
        if ($rootScope.clientPlayer.buys === 0) return;
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        var maxBuyable = $rootScope.clientPlayer.coins;
        if (maxBuyable > 10) maxBuyable = 10;
        for (var i = 0; i <= maxBuyable; i++) {
            $(".buyable .card.COST" + i).removeClass("disabled");
        }
    });
    $rootScope.$watch("gameState.phase", function() {
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        $(".your.player .hand .action").addClass("disabled");
        if ($rootScope.gameState.phase == "action" && $rootScope.clientPlayer.actions > 0) $(".your.player .hand .action").removeClass("disabled");
    });

    socket.on("log", function(msg) {
        $("#output").append("<br/>" + msg);
        $("#output")[0].scrollTop = $("#output")[0].scrollHeight;
    });
    socket.on("gameState", function(update) {
        $rootScope.you = {
            id: "/#" + socket.id
        };
       
        $rootScope.gameState = update;
        $rootScope.$apply();
        if ($rootScope.gameState.phase == "pregame") return;
        
        playerID = "/#" + socket.id;
        $rootScope.clientPlayer = $rootScope.gameState.players[playerID];
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
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                $(".selectable").removeClass("selectable");
                socket.emit("select", $rootScope.gameState.queryData.selected);
            }
        }
        if ($rootScope.gameState.phase === "choose") {
            $(".choice-dialog .button").addClass("choosable");
        }
    });
    $rootScope.endTurn = function() {
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        if ($rootScope.gameState.phase == "select" || $rootScope.gameState.phase == "choose") return;
        socket.emit("endTurn", {});
    };
    $rootScope.choose = function(index, event) {
        if ($(event.target).hasClass("choosable")) {
            $(event.target).removeClass("choosable");
            $rootScope.gameState.queryData.selected.push(index);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                socket.emit("callback", $rootScope.gameState.queryData.selected);
            }
        }
    }
    $rootScope.select = function(card, index, zone, event) { // user clicked on a card
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;

        if ($rootScope.gameState.phase === "action" && zone == "hand") {
            socket.emit("play", {
                cardID: card.id,
                cardIndex: index,
                playerID: playerID
            });
        }
        if ($rootScope.gameState.phase === "buy" && zone == "hand" && cards[card.id].type.indexOf("treasure") >= 0) {
            socket.emit("play", {
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
        if ($rootScope.gameState.phase === "select" && $(event.currentTarget).hasClass("selectable")) {
            if ($rootScope.gameState.queryData.unique === true) {
                $(event.currentTarget).removeClass("selectable");
            }
            var data = {
                card: card,
                index: index,
                zone: zone,
            };
            $rootScope.gameState.queryData.selected.push(data);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                $(".selectable").removeClass("selectable");
                socket.emit("select", $rootScope.gameState.queryData.selected);
            }
        }
    };
    $rootScope.startGame = function(debugFlag) {     
        $(".start.button").hide();
        socket.emit("startGame", debugFlag);
    };
    $rootScope.submit = function() {
        $(".selectable").removeClass("selectable");
        socket.emit("select", $rootScope.gameState.queryData.selected);
    };
});
