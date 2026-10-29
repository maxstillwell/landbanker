"use client";

import { useState } from "react";
import s from "./marketing.module.css";

export function Enquiry({ email }: { email: string | null }) {
  const [status, setStatus] = useState("");
  return (
    <form
      className={s.enquiry}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const subject = `LandOS enquiry: ${data.get("topic")}`;
        const body = `Name: ${data.get("name")}\nReply email: ${data.get("email")}\n\n${data.get("message")}`;
        if (email) {
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          setStatus(
            "Your email app has been requested. Review and send the message there; this website has not sent it.",
          );
        } else {
          const url = URL.createObjectURL(
            new Blob([`${subject}\n\n${body}`], {
              type: "text/plain;charset=utf-8",
            }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "landos-enquiry.txt";
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setStatus(
            "Your enquiry has been prepared as a text file. It has not been sent. A public contact address is not yet listed.",
          );
        }
      }}
    >
      <h2>{email ? "Prepare an enquiry" : "Outline your requirements"}</h2>
      <p>
        {email
          ? "Prepare a message in your own email app. You can review it before sending."
          : "A public contact address is not yet listed. You can prepare and download your enquiry here for your records; this form does not send a message."}
      </p>
      <label htmlFor="enquiry-name">
        Your name
        <input
          id="enquiry-name"
          name="name"
          autoComplete="name"
          required
          maxLength={120}
        />
      </label>
      <label htmlFor="enquiry-email">
        Your email
        <input
          id="enquiry-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label htmlFor="enquiry-topic">
        What would you like to discuss?
        <select id="enquiry-topic" name="topic">
          <option>Product and access</option>
          <option>Layers and coverage</option>
          <option>Professional workflow</option>
          <option>General enquiry</option>
        </select>
      </label>
      <label htmlFor="enquiry-message">
        Tell us about your requirements
        <textarea
          id="enquiry-message"
          name="message"
          rows={5}
          required
          maxLength={2000}
          placeholder="Your workflow, locations of interest and the information you need…"
        />
      </label>
      <button className={s.action} type="submit">
        {email ? "Open in email app ↗" : "Download enquiry ↓"}
      </button>
      <p className={s.formStatus} role="status">
        {status || "Your form entries are not stored or submitted to a server."}
      </p>
    </form>
  );
}
