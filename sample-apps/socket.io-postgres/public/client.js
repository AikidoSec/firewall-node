const chat = document.getElementById("chat");
const messageInput = document.getElementById("message");

const socket = io();

socket.on("message", (message) => {
  const messageEle = document.createElement("div");
  messageEle.textContent = message;
  chat.appendChild(messageEle);
  chat.scrollTop = chat.scrollHeight;
});

socket.on("close", () => {
  messageInput.disabled = true;
  chat.appendChild(document.createElement("div")).textContent =
    "Connection closed";
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && messageInput.value.trim() !== "") {
    socket.emit("sendMessage", messageInput.value);
    messageInput.value = "";
  }
});
