// Import functions
import { fCreateNoiseSample } from "./functions/CreateNoise.js";
import { fcreateBPFilter } from "./functions/BPFilter.js";

// Create contexts 
const ctxAudio = new(window.AudioContext || window.webkitAudioContext)();
const filterCanvas = document.getElementById('filterCanvas');

// Frequency parameters
const nFreqs = 100;
const Freqs = new Float32Array(nFreqs);

//Fill freqs area with values ranging from 20 to 20,000Hz
for (let i=0;i<nFreqs;++i){
     Freqs[i] = 20000/nFreqs*(i+1)
    };
const minF = Freqs[0];
const maxF = Freqs[nFreqs - 1];

// Set up filter globally so it can be updated with key presses
const filter = fcreateBPFilter(ctxAudio,Freqs[0],Freqs[nFreqs-1])

//let variables to be modified by user input
let curMaxF, curMinF, CF, BW, Q;
let finalCoords = {};
let source, state, shifted;

//Create object to store data
let data = {
    trl: [],
    lower:[],
    higher:[],
}

//Funtion to centre new elements
function center(elem) {
    elem.style.display = "flex";
    elem.style.justifyContent = "center"; // Center horizontally
    elem.style.alignItems = "center";    // Center vertically
    elem.style.height = "100vh";         // Full viewport height
    elem.style.width = "100vw";          // Full viewport width
}

//function to remove dynamically created div
function removeElement(htmlID){
    const elem = document.getElementById(htmlID);
    elem.remove();
}

window.onload = () =>{

    let trl = 1; // start count trials
    const noTrls = 10;

    // Define rectangle properties before drawing
    let rectWidth = 400; 
    let rectHeight = 140;   
    let zeroX = 0;  // starting x position
    let zeroY = 30; // Because top left is 0, canvas height is 180, and rec height is 50   

    // Function to log coordinates of rectangle
    function updateCoords() {
        finalCoords.topLeft = {x: zeroX, y: zeroY};
        finalCoords.topRight = {x: zeroX+rectWidth, y: zeroY}
        finalCoords.bottomLeft =  {x:zeroX, y: zeroY + rectHeight};
        finalCoords.bottomRight = {x: zeroX + rectWidth, y: zeroY + rectHeight} 
    }
    updateCoords()

    // Draw the rectangle
    const ctxRect = filterCanvas.getContext('2d');

    function drawRectangle() {
        ctxRect.clearRect(0, 0, filterCanvas.width, filterCanvas.height); 
        ctxRect.fillStyle = 'rgba(0, 0, 0, 0.3)'; 
        if (finalCoords.bottomRight.y > filterCanvas.height){
            rectHeight = filterCanvas.height - finalCoords.topLeft.y;
            ctxRect.fillRect(zeroX, zeroY, rectWidth, rectHeight);
        }
        else if (finalCoords.bottomRight.x > filterCanvas.width){
            rectWidth = filterCanvas.width - finalCoords.topLeft.x;
            ctxRect.fillRect(zeroX, zeroY, rectWidth, rectHeight);
        }
        else{
            ctxRect.fillRect(zeroX, zeroY, rectWidth, rectHeight);
        }
    }
    drawRectangle(); // draw before user interacion

    // Function to calculate Q, CF and BW from rectangle coordinates for web display
    function calcFiltVars(){
        
        // Calculate curMaxF and curMinF logarithmically
        curMaxF = minF * Math.pow(maxF / minF, 1 - finalCoords.topLeft.y / filterCanvas.height);  
        curMinF = minF * Math.pow(maxF / minF, 1 - finalCoords.bottomLeft .y/ filterCanvas.height);

        // calculate bandwidth, central frequency and Q from user input
        BW = Math.round(curMaxF - curMinF);
        CF = Math.round((curMaxF + curMinF)/2);
        Q = (CF/BW).toFixed(2);

        //update filter in RT
        filter.Q.value = Q;
        filter.frequency.value = CF;  

        // display BW, W, and Q on webpage
        document.getElementById("BW").textContent = BW;
        document.getElementById("qValue").textContent = Q;  
        document.getElementById("CF").textContent = CF;
    }

    // Create instruction text box 
    let instructionText = document.createElement("div");
    instructionText.id = 'instructCont';
    instructionText.style.fontSize = '20px';
    instructionText.style.fontWeight = 'bold'; 
    instructionText.innerHTML = `PRESS SPACE BAR TO START TRIAL ${trl}/${noTrls}`;
    document.body.appendChild(instructionText);

    calcFiltVars() //update webpage on window onload

    // Update shifted and source variables to track states
    shifted = false; 
    state = 'awaiting start';

    // Keyboard controls to user interaction
    document.onkeydown = (event) => {

        // update every time there's user interaction
        calcFiltVars();

        // Play noise with RT filter
        if (state === 'awaiting start' && event.key === " " && trl <= noTrls){

            state = 'playing filtered noise'; // update state
            document.getElementById("instructCont").innerText = 'PRESS ENTER ONCE YOU FOUND THE REPEAT IN THE FREQUENCY SEGMENT';

            if (trl === 1){  
                removeElement('playCont');//remove play container instructions
                removeElement('confirmCont');
            }

            //Declare original noise variable globally
            const duration = 0.5;// in seconds
            const noise = fCreateNoiseSample(ctxAudio,duration);

            console.log(trl);
            console.log(noise.getChannelData(0).slice(0,2));

            // Create the buffer source and connect to the filter
            source = ctxAudio.createBufferSource();
            source.buffer = noise;
            source.loop = true; 
            source.connect(filter).connect(ctxAudio.destination);
            source.start(ctxAudio.currentTime);
        }

        //stop noise 
        else if (state === 'playing filtered noise' && event.key === 'Escape'){
            source.stop(ctxAudio.currentTime);
            state = 'awaiting start';
            instructionText.innerHTML = `PRESS SPACE BAR TO START TRIAL ${trl}/${noTrls}`;  
        }
        //confirmation of frequency range
        else if (state === 'playing filtered noise' && event.key ==='Enter'){

            // stop source and return state to null
            source.stop(ctxAudio.currentTime);
            state = 'awaiting start';

            //Reset rectangle with random values
            rectHeight = Math.floor(Math.random()*(filterCanvas.height-1))+1;//ensures rectangle height won't exceed bounds
            zeroY = Math.floor(Math.random()*(filterCanvas.height - rectHeight));
            updateCoords();
            drawRectangle();
            
            //Save data
            data.trl.push(trl);
            data.lower.push(curMinF);
            data.higher.push(curMaxF);

            // handle end of trials
            if (trl === noTrls){
                console.log(data);

                //Create averaging function
                function getAvg(Arr){
                    const sum = Arr.reduce((accumulator,currentValue) => accumulator + currentValue,0);
                    const avg = sum/Arr.length;
                    return avg;
                }
                const highMn = getAvg(data.higher);
                const lowMn = getAvg(data.lower);

                //remove other containers
                removeElement('filterCont');
                removeElement('instructCont');

                // Message to thank people for participating
                const endDiv = document.createElement("Div");
                endDiv.style.fontSize = "20px";
                endDiv.style.fontWeight = "bold";
                endDiv.innerHTML = `Thank you for participating. You heard the repeating noise within a range from ${lowMn.toFixed(0)}-${highMn.toFixed(0)}Hz`;
                center(endDiv);
                document.body.appendChild(endDiv);
            }
            trl ++; //update trl number
            instructionText.innerHTML = `PRESS SPACE BAR TO START TRIAL ${trl}/${noTrls}`;
        }
    
        // Handle events that are shifted 
        if (event.shiftKey && shifted === false){
            shifted = true;
        }
        else if (event.shiftKey && shifted === true){
            shifted = false;
        }

        // Change rectangle height
        let freqSteps = 2;
        if (event.key === 'h' && shifted === false){
            rectHeight += freqSteps;
        }
        else if (event.key === 'h' && shifted === true){
            rectHeight = Math.max(freqSteps, rectHeight - freqSteps);
        }
        // Move rectangle
        else if (event.key === 'ArrowUp'){
            zeroY = Math.max(0, zeroY - freqSteps);
        }
        else if (event.key === 'ArrowDown'){
            zeroY = Math.min(filterCanvas.height - rectHeight, zeroY + freqSteps);
        }
        //update coordinates after interaction so they can be used to calculate time-freq cut offs. 
        updateCoords(); 
        drawRectangle();
        
    }
};

