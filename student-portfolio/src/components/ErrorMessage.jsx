function ErrorMessage({ message }) {
  return (
    <h2 style={{ color: "red" }}>
      Error: {message}
    </h2>
  );
}

export default ErrorMessage;
