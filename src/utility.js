export const range = (start, end) => {
  const arr = Array(end - start);
  for (let i = 0; i < end - start; i++) {
    arr[i] = i+start;
  }
  return arr;
}
