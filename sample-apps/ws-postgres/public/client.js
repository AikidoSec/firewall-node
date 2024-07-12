const chat = document.getElementById("chat");
const messageInput = document.getElementById("message");

const ws = new WebSocket("ws://localhost:8090");

ws.onmessage = (event) => {
  const message = document.createElement("div");
  message.textContent = event.data;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
};

ws.onclose = () => {
  messageInput.disabled = true;
  chat.appendChild(document.createElement("div")).textContent =
    "Connection closed";
};

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && messageInput.value.trim() !== "") {
    ws.send(messageInput.value);
    messageInput.value = "";
  }
});
