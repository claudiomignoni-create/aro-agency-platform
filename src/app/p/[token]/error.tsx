"use client";

import Image from "next/image";
import "./public-presentation.css";

export default function PublicPresentationError({ reset }: { reset: () => void }) {
  return (
    <main className="aro-public-unavailable">
      <div>
        <Image alt="ARO" height={72} priority src="/brand/aro-mark.png" width={72} />
        <p className="aro-public-eyebrow">Private presentation</p>
        <h1>We could not open this presentation</h1>
        <p>Please check your connection and try again. No selection was changed.</p>
        <button onClick={reset} type="button">
          Try again
        </button>
      </div>
    </main>
  );
}
