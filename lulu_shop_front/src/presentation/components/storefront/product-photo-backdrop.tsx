import Image from "next/image";

type ProductPhotoBackdropProps = {
  src: string;
};

export function ProductPhotoBackdrop({ src }: ProductPhotoBackdropProps) {
  return (
    <span className="product-photo-backdrop" aria-hidden="true">
      <Image
        className="product-photo-backdrop-image"
        src={src}
        alt=""
        fill
        sizes="(max-width: 600px) 40vw, 15vw"
        quality={25}
        loading="lazy"
      />
    </span>
  );
}
