const { exec, spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const http = require("node:http");
const express = require("express");
const {Server} = require("socket.io");

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/data/*", (req, res) => {
    res.sendFile(path.join(__dirname, req.url));
});

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    let spawnedProcess = null;

    socket.on("compile", (code, cb) => {

        if (spawnedProcess) {
            spawnedProcess.kill("SIGINT");
            spawnedProcess = null;
        }

        const modifiedCode = code.replace(/(printf\(.*?\);|putchar\(.*?\);|puts\(.*?\);)/g, '$1 fflush(stdout);');

        const filename = Math.random().toString(36).slice(2, 6);
        const inputFilepath = path.join(__dirname, "../tmp", filename + ".c");
        const outputFilepath = path.join(__dirname, "../tmp", filename);

        fs.writeFile(inputFilepath, modifiedCode, (error) => {
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

                cb(true, inputFilepath.toString().replace(__dirname, ''));

                // Execute the compiled code
                spawnedProcess = spawn(outputFilepath);

                spawnedProcess.stdout.on("data", (data) => {
                    socket.emit("output", data.toString());
                });

                spawnedProcess.stderr.on("data", (error) => {
                    socket.emit("output", error.toString());
                });

                spawnedProcess.on("exit", (code) => {
                    socket.emit("output",
                        code !== 0
                            ? `==== Program exited with code ${code} ====`
                            : `=== Program finished ====`
                    );
                    try {
                        fs.unlinkSync(inputFilepath);
                        fs.unlinkSync(outputFilepath);
                    } catch (error) {
                        console.log(error);
                    }
                });

                socket.removeAllListeners("userInput");

                socket.on("userInput", (input) => {
                    console.log(input);
                    if (spawnedProcess && spawnedProcess.stdin.writable) {
                        spawnedProcess.stdin.write(input + "\n");
                    }
                });

            });
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        if (spawnedProcess) {
            spawnedProcess.kill("SIGINT");
            spawnedProcess = null;
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});