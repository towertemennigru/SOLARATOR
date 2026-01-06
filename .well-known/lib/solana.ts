import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// RPC URL'ini .env dosyasından çekiyoruz
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC || "https://api.mainnet-beta.solana.com";

export async function findEmptyTokenAccounts(walletAddress: string) {
  const connection = new Connection(HELIUS_RPC);
  const owner = new PublicKey(walletAddress);

  // Token hesaplarını çek
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  // Sadece bakiyesi 0 olanları filtrele (Rent Reclamation)
  const emptyAccounts = accounts.value.filter((acc) => {
    const amount = acc.account.data.parsed.info.tokenAmount.uiAmount;
    return amount === 0; // Bakiyesi 0 olanlar
  }).map(acc => ({
    pubkey: acc.pubkey,
    mint: acc.account.data.parsed.info.mint,
    decimals: acc.account.data.parsed.info.tokenAmount.decimals
  }));

  return emptyAccounts;
}

export async function createCloseParams(walletAddress: string, accountPubkeys: PublicKey[]) {
  const connection = new Connection(HELIUS_RPC);
  const owner = new PublicKey(walletAddress);
  
  // İşlem oluştur (TOKEN_PROGRAM_ID ile kapatma talimatı)
  // Not: Solana'da tek seferde çok fazla instruction gönderilemez, gerekirse parçalanmalı.
  // Burada basitlik adına tek transaction yapıyoruz.
  
  const transaction = new Transaction();
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner;

  accountPubkeys.forEach((pubkey) => {
    // Kapatılan hesabın rent ücreti owner'a (sana) geri döner
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: pubkey, isSigner: false, isWritable: true }, // Kapanacak hesap
        { pubkey: owner, isSigner: false, isWritable: true },  // Rent'i alacak hesap
        { pubkey: owner, isSigner: true, isWritable: false }   // Yetkili imza
      ],
      programId: TOKEN_PROGRAM_ID,
      data: Buffer.from([9]) // 9 = CloseAccount instruction index
    });
    transaction.add(ix);
  });

  return transaction;
}
