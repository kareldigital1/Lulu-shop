import { ImageResponse } from "next/og";

export const socialImageAlt =
  "Tata Lulu Shop, friperie femme à Abomey-Calavi";
export const socialImageSize = {
  width: 1200,
  height: 630,
};
export const socialImageContentType = "image/png";

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, #fffdf8 0%, #f6eadc 62%, #efd9c4 100%)",
          color: "#251e19",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          padding: "70px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            backgroundColor: "#9b3d50",
            borderRadius: "999px",
            height: "340px",
            opacity: 0.08,
            position: "absolute",
            right: "-90px",
            top: "-100px",
            width: "340px",
          }}
        />
        <div
          style={{
            border: "2px solid rgba(155, 61, 80, 0.2)",
            borderRadius: "34px",
            bottom: "34px",
            left: "34px",
            position: "absolute",
            right: "34px",
            top: "34px",
          }}
        />
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            maxWidth: "950px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#ad7d17",
              display: "flex",
              fontSize: "25px",
              fontWeight: 700,
              letterSpacing: "8px",
              marginBottom: "34px",
              textTransform: "uppercase",
            }}
          >
            Friperie femme
          </div>
          <div
            style={{
              color: "#8c3b4a",
              display: "flex",
              fontFamily: "Georgia, serif",
              fontSize: "94px",
              fontWeight: 700,
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Tata Lulu Shop
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "30px",
              lineHeight: 1.4,
              marginTop: "34px",
            }}
          >
            Pièces uniques, qualité choisie et commande sur WhatsApp
          </div>
          <div
            style={{
              borderTop: "2px solid rgba(173, 125, 23, 0.55)",
              color: "#5b5149",
              display: "flex",
              fontSize: "24px",
              marginTop: "38px",
              paddingTop: "24px",
            }}
          >
            Atrokpocodji · Abomey-Calavi · Bénin
          </div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
