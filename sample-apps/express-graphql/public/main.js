document.addEventListener("DOMContentLoaded", async () => {
  fetchCats();

  document
    .getElementById("add-cat-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const petname = document.getElementById("petname").value;
      const age = document.getElementById("age").value;
      const res = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation addCat($name: String!, $age: Int!) {
              addCat(petname: $name, age: $age)
            }
          `,
          variables: {
            name: petname,
            age: parseInt(age, 10),
          },
        }),
      });
      if (res.ok) {
        fetchCats();
      } else {
        const errMsg = await res.text();
        alert(errMsg);
      }
    });
});

async function fetchCats() {
  const listEle = document.getElementById("cats");
  listEle.innerHTML = "";
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query {
          cats(name: "1' OR 1=1; -- ") {
            petname
            age
          }
        }
      `,
    }),
  });
  const json = await response.json();
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    listEle.innerHTML = `<strong>Error:</strong> ${json.errors[0].message}`;
    return;
  }
  const cats = json.data.cats;
  if (!cats) {
    listEle.innerHTML = "No cats found";
    return;
  }
  for (const cat of cats) {
    const li = document.createElement("li");
    li.innerText = `${cat.petname} - ${cat.age}`;
    listEle.appendChild(li);
  }
}
