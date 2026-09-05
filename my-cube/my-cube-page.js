import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";
import { backendApiUrl } from "../src/config/clientConfig.js";

const loginPath = `/login/?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
const content = document.querySelector(".about-content");
const menuLinks = [...document.querySelectorAll(".about-menu > a")];
const sidebarStatus = document.querySelector(".about-sidebar-status");
const USERNAME_MAX_LENGTH = 24;

function calculateAge(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || "")) return null;
  const [year, month, day] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const birthdayHasPassed = now.getMonth() + 1 > month
    || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

function setMenuState(requiresBirthday) {
  const firstLink = menuLinks[0];
  if (firstLink) {
    firstLink.href = requiresBirthday ? "#birthday" : "#item1";
    firstLink.querySelector("span").textContent = requiresBirthday ? "Birthday" : "Basics";
    firstLink.classList.add("is-active");
    firstLink.setAttribute("aria-current", "page");
  }

  menuLinks.slice(1).forEach((link) => {
    link.hidden = requiresBirthday;
  });

  if (sidebarStatus) {
    sidebarStatus.textContent = requiresBirthday ? "Required to continue" : "";
  }
}

function setFormStatus(statusElement, message, state = "") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function birthdayFormMarkup() {
  return `
    <div class="birthday-view" id="birthday">
      <div class="birthday-intro">
        <p class="about-label">One important detail</p>
        <h1 id="birthday-title">Tell us when you were born.</h1>
        <p class="about-lede">Your birthday helps us create the right, safer experience for your age.</p>
      </div>

      <div class="birthday-workspace">
        <section class="birthday-guidance" aria-labelledby="birthday-guidance-title">
          <p class="birthday-kicker">A safer world for everyone</p>
          <h2 id="birthday-guidance-title">Real age, real protections.</h2>
          <p>cubacadabra takes COPPA and child safety seriously, so we need your real age to apply the right safeguards.</p>
          <p>If you’re a kid, please don’t lie about your age. If you follow the rules, tell us your real birthday, and have a parent sign up too, you can have a fun, safe experience—and your parent will know which cubes you’re using.</p>
        </section>

        <form class="birthday-form" novalidate>
          <div class="birthday-form-heading">
            <p class="birthday-kicker">Your birthday</p>
            <p>Use the date on your official records. No time or location is needed.</p>
          </div>
          <div class="birthday-fields" role="group" aria-labelledby="birthday-fields-label">
            <span class="sr-only" id="birthday-fields-label">Birthday date</span>
            <label class="birthday-field birthday-field-year">
              <span>Year</span>
              <input name="year" type="text" inputmode="numeric" autocomplete="bday-year" maxlength="4" pattern="[0-9]{4}" placeholder="YYYY" autofocus required />
            </label>
            <label class="birthday-field">
              <span>Month</span>
              <input name="month" type="text" inputmode="numeric" autocomplete="bday-month" maxlength="2" pattern="[0-9]{1,2}" placeholder="MM" required />
            </label>
            <label class="birthday-field">
              <span>Day</span>
              <input name="day" type="text" inputmode="numeric" autocomplete="bday-day" maxlength="2" pattern="[0-9]{1,2}" placeholder="DD" required />
            </label>
          </div>
          <p class="birthday-form-note">Please enter a complete, valid calendar date.</p>
          <p class="birthday-status" role="alert" aria-live="polite"></p>
          <button class="birthday-submit" type="submit">Save birthday</button>
        </form>
      </div>
    </div>`;
}

function parentStepMarkup() {
  return `
    <div class="birthday-view birthday-view-parent" id="birthday">
      <div class="birthday-intro">
        <p class="about-label">A parent or guardian is next</p>
        <h1 id="parent-title">Let’s bring a parent in.</h1>
        <p class="about-lede">Thanks for sharing your real birthday. Because you’re under 13, we need a parent’s email before you can continue.</p>
      </div>

      <div class="birthday-workspace birthday-workspace-parent">
        <section class="birthday-guidance" aria-labelledby="parent-guidance-title">
          <p class="birthday-kicker">Why we ask</p>
          <h2 id="parent-guidance-title">Safety works better together.</h2>
          <p>Ask your parent or guardian to sign up with you. They’ll be able to know which cubes you’re using while you enjoy a fun, safe experience.</p>
          <p class="birthday-parent-note">Please ask a parent or guardian for permission before entering their email.</p>
        </section>

        <form class="birthday-form parent-email-form" novalidate>
          <div class="birthday-form-heading">
            <p class="birthday-kicker">Parent or guardian email</p>
            <p>We’ll use this to start the parent sign-up step.</p>
          </div>
          <label class="parent-email-field">
            <span>Email address</span>
            <input id="parent-email" name="parent-email" type="email" autocomplete="email" placeholder="parent@example.com" required autofocus />
          </label>
          <p class="birthday-status" role="status" aria-live="polite"></p>
          <button class="birthday-submit" type="submit">Continue with a parent</button>
        </form>
      </div>
    </div>`;
}

function basicsMarkup() {
  return `
    <div class="basics-view" id="item1">
      <div class="basics-workspace">
        <section class="basics-guidance" aria-labelledby="basics-guidance-title">
          <h2>A name people can recognize.</h2>
          <p>Your username is how other players will see you in the world. Pick something that feels like you and is easy to remember.</p>
        </section>

        <form class="basics-form" novalidate>
          <div class="birthday-form-heading">
            <p>This name will appear to other players when you’re in a world together.</p>
          </div>
          <label class="basics-field" for="my-cube-username">
            <span>Username</span>
            <input id="my-cube-username" name="username" type="text" autocomplete="nickname" minlength="2" maxlength="${USERNAME_MAX_LENGTH}" pattern="[A-Za-z0-9_\\-]+" aria-describedby="my-cube-username-help basics-username-status" spellcheck="false" required />
          </label>
          <p class="basics-field-help" id="my-cube-username-help">letters, numbers, _ or -</p>
          <p class="basics-status" id="basics-username-status" role="status" aria-live="polite"></p>
          <button class="basics-submit" type="submit">Save</button>
        </form>
      </div>
    </div>`;
}

function normalizeUsername(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidUsername(username) {
  return username.length >= 2
    && username.length <= USERNAME_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(username);
}

function renderBirthdayForm() {
  setMenuState(true);
  content.innerHTML = birthdayFormMarkup();
  const form = content.querySelector(".birthday-form");
  const status = content.querySelector(".birthday-status");
  const submit = form.querySelector(".birthday-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const year = form.elements.year.value.trim();
    const month = form.elements.month.value.trim();
    const day = form.elements.day.value.trim();
    const monthNumber = Number(month);
    const dayNumber = Number(day);

    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)
      || monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
      setFormStatus(status, "Enter a complete, valid birthday.", "error");
      return;
    }

    submit.disabled = true;
    setFormStatus(status, "Saving your birthday…");
    const dob = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;

    try {
      const response = await fetch(backendApiUrl("/auth/birthday"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dob }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.user?.dob) throw new Error(result?.error || "birthday_save_failed");

      const age = Number.isInteger(result.age) ? result.age : calculateAge(result.user.dob);
      if (age < 13) {
        renderParentStep();
      } else {
        renderBasics(result.user);
      }
    } catch (error) {
      submit.disabled = false;
      setFormStatus(
        status,
        error.message === "invalid_date_of_birth"
          ? "That date is not valid. Check the year, month, and day, then try again."
          : "We couldn’t save your birthday. Please try again.",
        "error",
      );
    }
  });
}

function renderParentStep() {
  setMenuState(true);
  content.innerHTML = parentStepMarkup();
  const form = content.querySelector(".parent-email-form");
  const email = content.querySelector("#parent-email");
  const status = content.querySelector(".birthday-status");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!email.validity.valid) {
      email.focus();
      setFormStatus(status, "Enter your parent or guardian’s email address.", "error");
      return;
    }
    setFormStatus(status, "Parent sign-up will continue here next.");
  });
  email.focus();
}

function renderBasics(user) {
  setMenuState(false);
  content.innerHTML = basicsMarkup();

  const form = content.querySelector(".basics-form");
  const input = content.querySelector("#my-cube-username");
  const status = content.querySelector("#basics-username-status");
  const submit = form.querySelector(".basics-submit");
  input.value = typeof user.username === "string" ? user.username : "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = normalizeUsername(input.value);
    input.value = username;

    if (!isValidUsername(username)) {
      input.setAttribute("aria-invalid", "true");
      setFormStatus(status, `Use 2–${USERNAME_MAX_LENGTH} letters, numbers, _ or -`, "error");
      input.focus();
      return;
    }

    input.removeAttribute("aria-invalid");
    submit.disabled = true;
    setFormStatus(status, "Saving your username…", "pending");

    try {
      const response = await fetch(backendApiUrl("/auth/username"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.user?.username !== "string") {
        throw new Error(result?.error || "username_save_failed");
      }

      input.value = result.user.username;
      setFormStatus(status, "Username saved.", "success");
    } catch (error) {
      setFormStatus(
        status,
          error.message === "username_taken"
          ? "That username is already in use. Try another."
          : error.message === "username_not_allowed"
            ? "That username isn’t available. Try another."
            : error.message === "invalid_username"
              ? `Use 2–${USERNAME_MAX_LENGTH} letters, numbers, _ or -.`
            : error.message === "age_required"
              ? "Complete the birthday step before choosing a username."
              : "We couldn’t save your username. Please try again.",
        "error",
      );
    } finally {
      submit.disabled = false;
    }
  });

  input.focus();
  input.select();
}

getCurrentUser().then((user) => {
  if (!user) {
    window.location.replace(loginPath);
    return;
  }

  initializeLogoutButton(user);
  document.body.dataset.authenticated = "true";

  const age = calculateAge(user.dob);
  if (!user.dob || age === null) {
    renderBirthdayForm();
  } else if (age !== null && age < 13) {
    renderParentStep();
  } else {
    renderBasics(user);
  }
});
