const { exec,spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
});

app.use(express.static("public"));
app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "src/index.html"));
});

io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("compile", (code, cb) => {
        const filename = Math.random().toString(36).slice(2, 6);
        const inputFilepath = path.join(__dirname, "tmp", filename + ".c");
        const outputFilepath = path.join(__dirname, "tmp", filename);

        fs.writeFile(inputFilepath, code, (error) => {
            if (error) {
                cb(false, "Error: " + error);
                return;
            }

            // Compile the code
            exec(`gcc ${inputFilepath} -o ${outputFilepath}`, (error, stdout, stderr) => {
                if (error) {
                    fs.unlinkSync(inputFilepath);
                    cb(false, stderr);
                    return;
                }

                cb(true, "Compilation succeeded");

                // Execute the compiled code
                const spawnedProcess = spawn(outputFilepath + ".exe");

                spawnedProcess.stdout.on("data", (data) => {
                    console.log(data.toString());
                    socket.emit("output", data.toString());
                });

                spawnedProcess.stderr.on("data", (error) => {
                    console.log(error.toString());
                    socket.emit("output", error.toString());
                });

                socket.on("userInput", (input) => {
                    if (spawnedProcess.stdin) {
                        spawnedProcess.stdin.write(input + "\n");
                    }
                });

                spawnedProcess.on("exit", () => {
                    try {
                        fs.unlinkSync(inputFilepath);
                        fs.unlinkSync(outputFilepath + ".exe");
                    } catch (error) {
                        console.log(error);
                    }
                    socket.emit("output", "==== Program finished ====");
                });

            });
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// TODO: Output is not streaming in real time, it waits until the program finishes