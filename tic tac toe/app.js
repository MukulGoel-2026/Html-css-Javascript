let boxes = document.querySelectorAll(".box")
let resbtn = document.querySelector("#resbtn") 
let msg = document.querySelector(".msg")
let win = document .querySelector(".win")
let Ngame = document.querySelector(".new-game")

let turn = true ; 

let wining = [
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6],
]

boxes.forEach((box) => {
    box.addEventListener("click",() => {
        if (turn) {
            box.innerText = "O" ;
            turn = false ;
        } else {
            box.innerText = "X" ;
            turn = true ;
        }
        box.disabled = true ;

        Winner();
    })
})
disableboxes = () =>{
    for(let box of boxes) {
        box.disabled = true ;
    }
};
showWinner = (x) => {
    msg.innerText = `congratulation winner is ${x}` ;
    win.classList.remove("hide") ;
    disableboxes();
}

let Winner = () => {
    for(let partten of wining ) {
        pos1val = boxes[partten[0]].innerText
        pos2val = boxes[partten[1]].innerText
        pos3val = boxes[partten[2]].innerText

        if ( pos1val != "" && pos2val != "" && pos3val != ""){
            if( pos1val === pos2val && pos2val === pos3val){
                showWinner(pos1val);
                
            }
        }
    }
}
let enable = () => {
    for(let box of boxes) {
        box.disabled = false ;
        box.innerText = " " ;
    }
}

let resetBtn = () => {
    turn = true ;
    enable();
    win.classList.add("hide")
}

resbtn.addEventListener("click", resetBtn);
Ngame.addEventListener("click", resetBtn);
