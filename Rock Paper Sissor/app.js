let userScore = 0 ;
let compScore = 0 ; 

const choices = document.querySelectorAll(".choice");
const msg = document.querySelector("#msg");

const userScorePara =document.querySelector("#user-score") ;
const compScorePara =document.querySelector("#comp-score") ;

const genCompChoice = () => {
    const options = ["rock","paper","sissor"] ;
    const random = Math.floor(Math.random() * 3 ) ;
    return options[random]
}

const drawGame = () => {
    msg.innerText = "Game was draw , Play gain." ;
    msg.style.backgroundColor = "#081b31" ;
}

const showWinner = (userWin , userChoice , compChoice) => {
    if(userWin == true){
        userScore++ 
        userScorePara.innerText = userScore ;
        msg.innerText = ` you Win ! your ${userChoice} beats ${compChoice} `;
        msg.style.backgroundColor = "green" ;
    } else {
        compScore++ 
        compScorePara.innerText = compScore ;
        msg.innerText = ` you lost  ${compChoice} beats your ${userChoice} `;
        msg.style.backgroundColor = "red" ;
    }
}

const playGame = (userChoice) => {
    // console.log("user choice =" , userChoice) ;
    // computer's choice
    const compChoice = genCompChoice() ;
    // console.log("comp choice =" , compChoice ) ;
    // draw
    if(userChoice === compChoice) {
        drawGame()
    } else {
        let userWin = true ;
        if(userChoice === "rock"){
            // sissor , paper
            userWin = compChoice === "sissor" ? true:false ;
        } else if (userChoice === "paper"){
            // sissor , rock
            userWin = compChoice === "sissor" ? false:true ;
        } else {
            // paper , rock
            userWin = compChoice === "paper" ? true:false ;
        }

        showWinner(userWin , userChoice , compChoice)
    }
}

choices.forEach((choice) => {
    choice.addEventListener("click", () => {
        const userChoice = choice.getAttribute("id") ; 
        playGame(userChoice) ;
    })
})